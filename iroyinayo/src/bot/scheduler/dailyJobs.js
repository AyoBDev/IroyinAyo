const cron = require('node-cron');
const db = require('../../config/database');
const contentAI = require('../../modules/content/content.ai');
const { formatQuiz, bold } = require('../formatters');
const { buildDailyQueue } = require('../../modules/habit/queueBuilder');
const { drainDailyQueue } = require('../../modules/habit/queueSender');
const { evaluatePositionTriggers, fireResolvedAwayNotifications } = require('../../modules/habit/positionTriggers');
const { snapshotDailyRanks } = require('../../modules/habit/dailyRankSnapshot');

// Random delay between messages to avoid WhatsApp ban (3-8 seconds)
function randomDelay() {
  const ms = 3000 + Math.random() * 5000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJid(student) {
  return student.whatsapp_jid || `${student.phone_number}@s.whatsapp.net`;
}

// Mutable reference so cron jobs always use the current socket
let activeSock = null;

function updateSocket(sock) {
  activeSock = sock;
}

function startScheduler(sock) {
  activeSock = sock;

  // AI content generation — 6am WAT daily (2 hours before digest)
  cron.schedule('0 6 * * *', async () => {
    console.log('Running AI content generation...');
    try {
      const results = await contentAI.generateDailyDigest();
      const success = results.filter((r) => r.status === 'success').length;
      const failed = results.filter((r) => r.status === 'error').length;
      console.log(`AI content generation done: ${success} created, ${failed} failed`);
    } catch (err) {
      console.error('AI content generation failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Daily rank snapshot — 00:30 WAT
  cron.schedule('30 0 * * *', async () => {
    console.log('Snapshotting daily ranks...');
    try {
      const result = await snapshotDailyRanks();
      console.log(`Rank snapshot saved: ${result.count} students`);
    } catch (err) {
      console.error('Rank snapshot failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Build today's WhatsApp daily queue — 5am WAT
  cron.schedule('0 5 * * *', async () => {
    console.log('Building WhatsApp daily queue...');
    try {
      const result = await buildDailyQueue({ targetDate: new Date() });
      console.log(`Queue built: enqueued=${result.enqueued} skipped=${result.skipped}`);
    } catch (err) {
      console.error('Queue build failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Drain WhatsApp daily queue — 6:55am WAT
  cron.schedule('55 6 * * *', async () => {
    console.log('Draining WhatsApp daily queue...');
    if (!activeSock) { console.error('Drain skipped: no active socket'); return; }
    try {
      const result = await drainDailyQueue();
      console.log(`Queue drained: sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`);
    } catch (err) {
      console.error('Queue drain failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Evaluate position triggers — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await evaluatePositionTriggers();
      await fireResolvedAwayNotifications();
    } catch (err) {
      console.error('Position triggers eval failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Midday quiz — 12pm WAT daily
  cron.schedule('0 12 * * *', async () => {
    console.log('Running midday quiz notification...');
    if (!activeSock) { console.error('Quiz notification skipped: no active socket'); return; }
    try {
      const students = await db('students').where({ is_banned: false, is_onboarded: true });
      const quiz = await db('quizzes').orderByRaw('RANDOM()').first();

      if (!quiz) return;

      let sent = 0;
      for (const student of students) {
        try {
          const jid = getJid(student);
          await activeSock.sendMessage(jid, {
            text: `🧠 ${bold('Midday Quiz!')}\n\nType ${bold('quiz')} to answer and earn points!`,
          });
          sent++;
          await randomDelay();
        } catch (err) {
          // Skip failed sends
        }
      }
      console.log(`Quiz notification sent to ${sent}/${students.length} students`);
    } catch (err) {
      console.error('Midday quiz failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Auto-close expired markets — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await db('markets')
        .where('status', 'open')
        .where('closes_at', '<=', new Date())
        .update({ status: 'closed' });
    } catch (err) {
      console.error('Market auto-close failed:', err);
    }
  });

  // Odds movement notifications — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    if (!activeSock) return;
    try {
      const now = new Date();
      const hour = now.toLocaleString('en-US', { timeZone: 'Africa/Lagos', hour: 'numeric', hour12: false });
      const hourNum = parseInt(hour, 10);
      if (hourNum >= 22 || hourNum < 7) return;

      const openMarkets = await db('multi_markets').where({ status: 'open' });

      for (const market of openMarkets) {
        const outcomes = await db('multi_market_outcomes')
          .where({ market_id: market.id })
          .orderBy('created_at', 'asc');
        const sharesSold = outcomes.map(o => o.shares_sold);
        const { calculatePrices } = require('../../modules/markets/multiMarkets.service');
        const currentPrices = calculatePrices(sharesSold, market.liquidity_b);

        const lastSnapshot = await db('market_price_snapshots')
          .where({ market_id: market.id })
          .orderBy('captured_at', 'desc')
          .first();

        const pricesData = outcomes.map((o, i) => ({ outcome_id: o.id, price: currentPrices[i] }));

        await db('market_price_snapshots').insert({
          market_id: market.id,
          prices: JSON.stringify(pricesData),
        });

        if (!lastSnapshot) continue;

        const oldPrices = JSON.parse(lastSnapshot.prices);

        for (let i = 0; i < outcomes.length; i++) {
          const oldEntry = oldPrices.find(p => p.outcome_id === outcomes[i].id);
          if (!oldEntry) continue;
          const shift = Math.abs(currentPrices[i] - oldEntry.price);
          if (shift < 0.10) continue;

          const holders = await db('multi_market_positions')
            .join('students', 'multi_market_positions.student_id', 'students.id')
            .where('multi_market_positions.market_id', market.id)
            .where('students.is_system', false)
            .select('students.id as student_id', 'students.phone_number', 'multi_market_positions.shares', 'multi_market_positions.entry_price');

          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

          for (const holder of holders) {
            const throttled = await db('notification_throttles')
              .where({ student_id: holder.student_id, market_id: market.id, type: 'odds_movement' })
              .where('sent_at', '>', sixHoursAgo)
              .first();
            if (throttled) continue;

            const oldPercent = Math.round(oldEntry.price * 100);
            const newPercent = Math.round(currentPrices[i] * 100);
            const entryPercent = holder.entry_price ? Math.round(holder.entry_price * 100) : null;
            const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';

            let text = `Odds moving on your prediction!\n\n"${market.title}"\n${outcomes[i].label}: ${oldPercent}% -> ${newPercent}%`;
            if (entryPercent != null) {
              text += `\nYour position: ${holder.shares.toFixed(1)} shares @ ${entryPercent}%`;
            }
            text += `\n\nCheck it: ${appUrl}/market/${market.id}`;

            const jid = `${holder.phone_number}@s.whatsapp.net`;
            try {
              await activeSock.sendMessage(jid, { text });
              await db('notification_throttles').insert({
                student_id: holder.student_id,
                market_id: market.id,
                type: 'odds_movement',
              });
            } catch (err) {
              // Skip failed sends
            }
            await randomDelay();
          }
          break;
        }
      }

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db('market_price_snapshots').where('captured_at', '<', dayAgo).del();
    } catch (err) {
      console.error('Odds movement check failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Near-resolution urgency — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    if (!activeSock) return;
    try {
      const now = new Date();
      const hour = now.toLocaleString('en-US', { timeZone: 'Africa/Lagos', hour: 'numeric', hour12: false });
      const hourNum = parseInt(hour, 10);
      if (hourNum >= 22 || hourNum < 7) return;

      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const closingMarkets = await db('multi_markets')
        .where({ status: 'open' })
        .whereNotNull('closes_at')
        .where('closes_at', '>', now)
        .where('closes_at', '<=', twoHoursFromNow);

      const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const market of closingMarkets) {
        const outcomes = await db('multi_market_outcomes')
          .where({ market_id: market.id })
          .orderBy('created_at', 'asc');
        const sharesSold = outcomes.map(o => o.shares_sold);
        const { calculatePrices } = require('../../modules/markets/multiMarkets.service');
        const prices = calculatePrices(sharesSold, market.liquidity_b);
        const topIndex = prices.indexOf(Math.max(...prices));
        const topOutcome = outcomes[topIndex];
        const topPercent = Math.round(prices[topIndex] * 100);

        const timeRemaining = Math.round((new Date(market.closes_at).getTime() - Date.now()) / (60 * 1000));
        const timeText = timeRemaining >= 60 ? `${Math.round(timeRemaining / 60)}h` : `${timeRemaining}m`;

        const activeStudents = await db('students')
          .whereIn('id', function() {
            this.select('student_id').from('multi_market_positions')
              .where('created_at', '>', weekAgo)
              .groupBy('student_id');
          })
          .whereNotIn('id', function() {
            this.select('student_id').from('multi_market_positions')
              .where('market_id', market.id);
          })
          .where('is_system', false)
          .where('is_banned', false)
          .select('id', 'phone_number');

        for (const student of activeStudents) {
          const throttled = await db('notification_throttles')
            .where({ student_id: student.id, type: 'closing_soon' })
            .where('sent_at', '>', oneDayAgo)
            .first();
          if (throttled) continue;

          const text = `Market closing soon!\n\n"${market.title}" closes in ${timeText}\nLeading: ${topOutcome.label} at ${topPercent}%\n\nPredict now: ${appUrl}/market/${market.id}`;

          const jid = `${student.phone_number}@s.whatsapp.net`;
          try {
            await activeSock.sendMessage(jid, { text });
            await db('notification_throttles').insert({
              student_id: student.id,
              market_id: market.id,
              type: 'closing_soon',
            });
          } catch (err) {
            // Skip failed sends
          }
          await randomDelay();
        }
      }
    } catch (err) {
      console.error('Closing-soon notifications failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  console.log('Scheduler started: daily rank snapshot (00:30), AI content (6am), WA queue build (5am), WA queue drain (6:55am), midday quiz (12pm), market auto-close (hourly), odds movement (15min), closing-soon (30min), position triggers (10min)');
}

module.exports = { startScheduler, updateSocket };
