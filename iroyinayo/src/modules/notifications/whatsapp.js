const { getBotSocket } = require('../../bot/botSocket');
const db = require('../../config/database');
const { generateWinImage } = require('../../utils/generateWinImage');

async function sendWhatsApp(phoneNumber, text) {
  const sock = getBotSocket();
  if (!sock) {
    console.log(`[NOTIFY] Bot offline. Message for ${phoneNumber}: ${text.slice(0, 50)}...`);
    return false;
  }

  try {
    const jid = `${phoneNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.log(`[NOTIFY] Send failed for ${phoneNumber}:`, err.message);
    return false;
  }
}

async function sendWhatsAppImage(phoneNumber, imageBuffer, caption) {
  const sock = getBotSocket();
  if (!sock) {
    console.log(`[NOTIFY] Bot offline. Image for ${phoneNumber}`);
    return false;
  }

  try {
    const jid = `${phoneNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { image: imageBuffer, caption });
    return true;
  } catch (err) {
    console.log(`[NOTIFY] Image send failed for ${phoneNumber}:`, err.message);
    return false;
  }
}

async function notifyMarketResolution(marketId, winnerLabel) {
  const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';

  // Active holders only; idle holders are handled by fireResolvedAwayNotifications (positionTriggers cron)
  const activeCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const positions = await db('multi_market_positions')
    .join('students', 'multi_market_positions.student_id', 'students.id')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
    .where('multi_market_positions.market_id', marketId)
    .where('students.is_system', false)
    .where('students.last_app_open_at', '>', activeCutoff)
    .select(
      'students.phone_number',
      'students.name',
      'students.referral_code',
      'students.last_app_open_at',
      'multi_market_positions.payout',
      'multi_market_positions.amount',
      'multi_market_positions.entry_price',
      'multi_markets.title',
      'multi_market_outcomes.label as outcome_label'
    );

  for (const pos of positions) {
    const won = pos.payout > 0;

    if (won) {
      const multiplier = pos.amount > 0 ? (pos.payout / pos.amount).toFixed(1) : '0.0';
      const refCode = pos.referral_code || '';

      try {
        const imageBuffer = generateWinImage({
          marketTitle: pos.title,
          outcomeLabel: pos.outcome_label,
          payout: pos.payout,
          amountSpent: pos.amount,
          entryPrice: pos.entry_price,
          referralCode: refCode,
        });

        const caption = `You won on IroyinMarket!\n\n"${pos.title}"\nYour pick: ${pos.outcome_label}\nPayout: +${pos.payout} pts (${multiplier}x return)\n\nOpen app: ${appUrl}/?ref=${refCode}`;
        await sendWhatsAppImage(pos.phone_number, imageBuffer, caption);
      } catch (err) {
        console.log(`[NOTIFY] Image generation failed for ${pos.phone_number}:`, err.message);
        const fallbackText = `You won on IroyinMarket!\n\n"${pos.title}"\nYour pick: ${pos.outcome_label}\nPayout: +${pos.payout} pts (${multiplier}x return)\n\nOpen app: ${appUrl}/?ref=${refCode}`;
        await sendWhatsApp(pos.phone_number, fallbackText);
      }
    } else {
      const text = `"${pos.title}" has been resolved.\nYour pick (${pos.outcome_label}) didn't win this time.\n\nNew markets are live — predict again: ${appUrl}`;
      await sendWhatsApp(pos.phone_number, text);
    }
  }
}

async function notifyWeeklyWinner(winnerId, weekStart) {
  const winner = await db('students').where({ id: winnerId }).first();
  if (!winner) return;

  const text = `Congratulations *${winner.name}*!\n\nYou're the #1 predictor this week on IroyinMarket!\n\nKeep your streak going → ${process.env.APP_URL || 'https://iroyinmarket.com'}`;
  await sendWhatsApp(winner.phone_number, text);

  const topPredictors = await db('students')
    .where('points_balance', '>', 0)
    .whereNot({ id: winnerId })
    .where('is_system', false)
    .orderBy('points_balance', 'desc')
    .limit(20)
    .select('phone_number', 'name');

  for (const student of topPredictors) {
    const announcement = `Weekly leaderboard reset!\n\n*${winner.name}* won this week.\n\nNew week, new chance. Make your predictions now → ${process.env.APP_URL || 'https://iroyinmarket.com'}`;
    await sendWhatsApp(student.phone_number, announcement);
  }
}

async function notifyNewMarket(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) return;

  const outcomes = await db('multi_market_outcomes').where({ market_id: marketId }).select('label');
  const optionsList = outcomes.slice(0, 5).map(o => `• ${o.label}`).join('\n');
  const moreText = outcomes.length > 5 ? `\n...and ${outcomes.length - 5} more` : '';

  const students = await db('students')
    .where({ is_verified: true })
    .where('is_system', false)
    .select('phone_number');

  const text = `*New Market*\n\n"${market.title}"\n\n${optionsList}${moreText}\n\nPredict now → ${process.env.APP_URL || 'https://iroyinmarket.com'}`;

  for (const student of students) {
    await sendWhatsApp(student.phone_number, text);
  }
}

async function notifyReferralWins(marketId) {
  const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';

  const wins = await db('multi_market_positions')
    .join('students', 'multi_market_positions.student_id', 'students.id')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .where('multi_market_positions.market_id', marketId)
    .where('multi_market_positions.payout', '>', 0)
    .where('students.is_system', false)
    .whereNotNull('students.referred_by')
    .select(
      'students.name as winner_name',
      'students.referred_by',
      'multi_market_positions.payout',
      'multi_markets.title'
    );

  const referrerIds = [...new Set(wins.map(w => w.referred_by))];
  if (referrerIds.length === 0) return;

  const referrers = await db('students').whereIn('id', referrerIds).select('id', 'phone_number', 'name');
  const referrerMap = Object.fromEntries(referrers.map(r => [r.id, r]));

  for (const win of wins) {
    const referrer = referrerMap[win.referred_by];
    if (!referrer) continue;

    const text = `Your referral *${win.winner_name}* just won +${win.payout} pts on "${win.title}"!\n\nKeep inviting friends → ${appUrl}`;
    await sendWhatsApp(referrer.phone_number, text);
  }
}

async function sendWhatsAppWithFailureTracking(student, text) {
  const ok = await module.exports.sendWhatsApp(student.phone_number, text);
  if (ok) {
    // Clear pause too — channel is working again.
    if (student.wa_failure_count > 0 || student.wa_paused_until) {
      await db('students').where({ id: student.id }).update({ wa_failure_count: 0, wa_paused_until: null });
    }
    return true;
  }
  const newCount = (student.wa_failure_count || 0) + 1;
  const update = { wa_failure_count: newCount };
  if (newCount >= 2) {
    update.wa_paused_until = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }
  await db('students').where({ id: student.id }).update(update);
  return false;
}

module.exports = { sendWhatsApp, sendWhatsAppImage, sendWhatsAppWithFailureTracking, notifyMarketResolution, notifyWeeklyWinner, notifyNewMarket, notifyReferralWins };
