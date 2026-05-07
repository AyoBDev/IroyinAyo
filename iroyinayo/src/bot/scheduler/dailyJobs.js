const cron = require('node-cron');
const db = require('../../config/database');
const contentService = require('../../modules/content/content.service');
const contentAI = require('../../modules/content/content.ai');
const gamificationService = require('../../modules/gamification/gamification.service');
const { formatFeed, formatQuiz, bold } = require('../formatters');

// Random delay between messages to avoid WhatsApp ban (3-8 seconds)
function randomDelay() {
  const ms = 3000 + Math.random() * 5000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJid(student) {
  return student.whatsapp_jid || `${student.phone_number}@s.whatsapp.net`;
}

function startScheduler(sock) {
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

  // Morning digest — 8am WAT daily
  cron.schedule('0 8 * * *', async () => {
    console.log('Running morning digest...');
    try {
      const students = await db('students').where({ is_banned: false, is_onboarded: true });

      let sent = 0;
      for (const student of students) {
        try {
          const feed = await contentService.getFeedForStudent(student.id);
          if (feed.length > 0) {
            const jid = getJid(student);
            const items = feed.slice(0, 3);
            await sock.sendMessage(jid, {
              text: `☀️ ${bold('Good morning, ' + student.name + '!')}\n\n${formatFeed(items)}`,
            });
            sent++;
            await randomDelay();
          }
        } catch (err) {
          console.error(`Failed digest for ${student.phone_number}:`, err.message);
        }
      }
      console.log(`Morning digest sent to ${sent}/${students.length} students`);
    } catch (err) {
      console.error('Morning digest failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Midday quiz — 12pm WAT daily
  cron.schedule('0 12 * * *', async () => {
    console.log('Running midday quiz notification...');
    try {
      const students = await db('students').where({ is_banned: false, is_onboarded: true });
      const quiz = await db('quizzes').orderByRaw('RANDOM()').first();

      if (!quiz) return;

      let sent = 0;
      for (const student of students) {
        try {
          const jid = getJid(student);
          await sock.sendMessage(jid, {
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

  console.log('Scheduler started: AI content (6am), morning digest (8am), midday quiz (12pm), market auto-close (hourly)');
}

module.exports = { startScheduler };
