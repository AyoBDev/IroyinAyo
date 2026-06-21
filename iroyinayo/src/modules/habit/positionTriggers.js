const db = require('../../config/database');
const notifications = require('../notifications/whatsapp');

const SHARP_MOVE_PP = 0.10;
const SHARP_MOVE_WINDOW_MS = 60 * 60 * 1000;
const RESOLVED_AWAY_USER_IDLE_MS = 12 * 60 * 60 * 1000;
const RESOLVED_AWAY_DAILY_GUARD_MS = 6 * 60 * 60 * 1000;

async function findResolutionTodayEligible(now) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('m.status', 'open')
    .whereNotNull('m.closes_at')
    .where('m.closes_at', '<=', horizon)
    .where('m.closes_at', '>', now)
    .where('s.is_system', false)
    .where('s.is_banned', false)
    .select('p.id as position_id');
}

async function findResolvedAwayEligible(now) {
  const userIdleCutoff = new Date(now.getTime() - RESOLVED_AWAY_USER_IDLE_MS);
  return db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('m.status', 'resolved')
    .whereNotNull('m.resolved_at')
    .where(function () {
      this.whereNull('s.last_app_open_at').orWhere('s.last_app_open_at', '<', userIdleCutoff);
    })
    .where('s.is_system', false)
    .where('s.is_banned', false)
    .select('p.id as position_id', 'p.student_id', 'p.payout', 'p.amount', 'm.title');
}

async function findSharpMoveEligible(now) {
  return [];
}

async function evaluatePositionTriggers({ now = new Date() } = {}) {
  const counts = { resolutionToday: 0, resolvedAway: 0, sharpMove: 0 };

  const resToday = await findResolutionTodayEligible(now);
  for (const r of resToday) {
    const inserted = await db('position_triggers')
      .insert({ position_id: r.position_id, condition: 'resolution_today', eligible_at: now })
      .onConflict(['position_id', 'condition']).ignore()
      .returning('id');
    if (inserted.length > 0) counts.resolutionToday += 1;
  }

  const resAway = await findResolvedAwayEligible(now);
  for (const r of resAway) {
    const inserted = await db('position_triggers')
      .insert({ position_id: r.position_id, condition: 'resolved_away', eligible_at: now })
      .onConflict(['position_id', 'condition']).ignore()
      .returning('id');
    if (inserted.length > 0) counts.resolvedAway += 1;
  }

  return counts;
}

async function fireResolvedAwayNotifications({ now = new Date() } = {}) {
  const guard = new Date(now.getTime() - RESOLVED_AWAY_DAILY_GUARD_MS);
  const eligible = await db('position_triggers as t')
    .join('multi_market_positions as p', 't.position_id', 'p.id')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('t.condition', 'resolved_away')
    .whereNull('t.fired_at')
    .where('s.is_banned', false)
    .whereNotExists(function () {
      this.select('*').from('whatsapp_daily_queue as q')
        .whereRaw('q.student_id = s.id')
        .where('q.status', 'sent')
        .where('q.sent_at', '>', guard);
    })
    .select('t.id', 's.id as student_id', 's.phone_number', 's.name', 's.wa_failure_count', 'p.payout', 'm.title');

  let fired = 0;
  const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';
  for (const e of eligible) {
    const won = (e.payout || 0) > 0;
    const text = `Your call on "${e.title}" resolved. ${won ? `Win.` : `Miss.`}\n\nOpen IroyinMarket → ${appUrl}?ref=wa_oneoff&lede=resolved_away`;
    const ok = await notifications.sendWhatsAppWithFailureTracking({ id: e.student_id, phone_number: e.phone_number, wa_failure_count: e.wa_failure_count }, text);
    if (ok) {
      await db('position_triggers').where('id', e.id).update({ fired_at: now, surfaced_via: 'wa_oneoff' });
      fired += 1;
    }
  }
  return fired;
}

module.exports = { evaluatePositionTriggers, fireResolvedAwayNotifications };
