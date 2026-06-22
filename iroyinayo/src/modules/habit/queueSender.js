const db = require('../../config/database');
const { renderMessage } = require('./messageRenderer');
const notifications = require('../notifications/whatsapp');
const { track } = require('../../utils/telemetry');

const PACING_MIN_MS = 4000;
const PACING_MAX_MS = 8000;
const LONG_PAUSE_EVERY = 50;
const LONG_PAUSE_MIN_MS = 30000;
const LONG_PAUSE_MAX_MS = 60000;
const FAILURE_HALT_RATE = 0.05;
const FAILURE_HALT_MIN_ATTEMPTS = 20;
const RECENT_ACTIVE_HOURS = 4;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function drainDailyQueue({
  now = new Date(),
  sendFn,
  sleepFn = (ms) => new Promise((r) => setTimeout(r, ms)),
  appUrl = process.env.APP_URL || 'https://iroyinmarket.com',
} = {}) {
  const send = sendFn || ((student, text) => notifications.sendWhatsAppWithFailureTracking(student, text));
  const rows = shuffle(await db('whatsapp_daily_queue').where({ status: 'pending' }).where('scheduled_for', '<=', now).select('*'));
  let sent = 0, failed = 0, skipped = 0;
  let attemptsInWindow = 0, failsInWindow = 0;

  for (let i = 0; i < rows.length; i++) {
    if (attemptsInWindow >= FAILURE_HALT_MIN_ATTEMPTS && failsInWindow / attemptsInWindow > FAILURE_HALT_RATE) {
      console.error(`[WA] Halting drain: failure rate ${failsInWindow}/${attemptsInWindow} exceeds ${FAILURE_HALT_RATE}`);
      break;
    }
    const row = rows[i];
    const student = await db('students').where('id', row.student_id).first();
    if (!student) { await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'failed', last_error: 'student_missing' }); failed += 1; continue; }

    const recentMs = student.last_app_open_at ? now - new Date(student.last_app_open_at) : Infinity;
    if (recentMs < RECENT_ACTIVE_HOURS * 60 * 60 * 1000) {
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'skipped', last_error: 'recent_active' });
      track('wa_daily_skipped', { user_id: student.id, reason: 'recent_active' });
      skipped += 1;
      continue;
    }

    const text = renderMessage({ student, queueRow: { ...row, markets: typeof row.markets === 'string' ? JSON.parse(row.markets) : row.markets }, appUrl });
    let ok;
    try {
      ok = await send(student, text);
    } catch (err) {
      ok = false;
      await db('whatsapp_daily_queue').where('id', row.id).update({ last_error: err.message });
    }
    attemptsInWindow += 1;
    if (ok) {
      sent += 1;
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'sent', sent_at: new Date(), attempts: row.attempts + 1, body_text: text });
      const marketsArray = typeof row.markets === 'string' ? JSON.parse(row.markets) : row.markets;
      track('wa_daily_sent', { user_id: student.id, lede_type: row.lede_type, markets_count: Array.isArray(marketsArray) ? marketsArray.length : 0, latency_from_scheduled: Date.now() - new Date(row.scheduled_for).getTime() });
    } else {
      failed += 1;
      failsInWindow += 1;
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'failed', attempts: row.attempts + 1, body_text: text });
      track('wa_daily_failed', { user_id: row.student_id, error_class: row.last_error || 'unknown' });
    }

    const isLast = i === rows.length - 1;
    if (!isLast) {
      if ((i + 1) % LONG_PAUSE_EVERY === 0) {
        await sleepFn(LONG_PAUSE_MIN_MS + Math.random() * (LONG_PAUSE_MAX_MS - LONG_PAUSE_MIN_MS));
        attemptsInWindow = 0; failsInWindow = 0;
      } else {
        await sleepFn(PACING_MIN_MS + Math.random() * (PACING_MAX_MS - PACING_MIN_MS));
      }
    }
  }
  return { sent, failed, skipped };
}

module.exports = { drainDailyQueue };
