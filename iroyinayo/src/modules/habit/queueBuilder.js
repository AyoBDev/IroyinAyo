const db = require('../../config/database');
const { pickLede } = require('./ledePicker');

const WINDOW_START_MIN = 7 * 60;       // 7:00 WAT
const WINDOW_END_MIN = 9 * 60 + 30;    // 9:30 WAT
const JITTER_MAX_MIN = 25;

function pickAnchorTime(rng = Math.random) {
  const span = WINDOW_END_MIN - WINDOW_START_MIN;
  const mins = Math.floor(WINDOW_START_MIN + rng() * span);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function jitterScheduledFor(anchorTime, targetDate, rng = Math.random) {
  const [h, m] = anchorTime.split(':').map(Number);
  const base = new Date(targetDate);
  base.setUTCHours(0, 0, 0, 0);
  // WAT is UTC+1 — convert WAT clock time to UTC by subtracting 1 hour
  const watOffsetMin = -60;
  const totalMin = h * 60 + m + watOffsetMin;
  const jitterMin = (rng() * 2 - 1) * JITTER_MAX_MIN;
  base.setTime(base.getTime() + (totalMin + jitterMin) * 60 * 1000);
  return base;
}

async function selectMarketsForUser(studentId, ledePayload) {
  const limit = 3;
  const namedMarketId = ledePayload?.marketId;
  const recentCategoryIds = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('p.student_id', studentId)
    .where('p.created_at', '>=', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
    .distinct('m.category')
    .select('m.category');
  const cats = recentCategoryIds.map((r) => r.category).filter(Boolean);

  let query = db('multi_markets as m')
    .leftJoin('multi_market_positions as own', function () {
      this.on('own.market_id', '=', 'm.id').andOnVal('own.student_id', '=', studentId);
    })
    .where('m.status', 'open')
    .whereNull('own.id')
    .select('m.id', 'm.title', 'm.closes_at', 'm.category');

  if (cats.length > 0) {
    query = query.orderByRaw(`CASE WHEN m.category = ANY(?) THEN 0 ELSE 1 END`, [cats]);
  }
  const fetched = await query.orderBy('m.created_at', 'desc').limit(limit * 2);

  const out = [];
  if (namedMarketId) {
    const named = await db('multi_markets').where('id', namedMarketId).first();
    if (named) out.push({ market_id: named.id, label: named.title, resolves_in_minutes: named.closes_at ? Math.max(0, Math.floor((new Date(named.closes_at) - Date.now()) / 60000)) : null });
  }
  for (const m of fetched) {
    if (out.length >= limit) break;
    if (out.some((x) => x.market_id === m.id)) continue;
    out.push({ market_id: m.id, label: m.title, resolves_in_minutes: m.closes_at ? Math.max(0, Math.floor((new Date(m.closes_at) - Date.now()) / 60000)) : null });
  }
  return out;
}

async function buildDailyQueue({ targetDate, now, rng = Math.random } = {}) {
  const effectiveNow = now || new Date();
  if (!targetDate) targetDate = new Date(effectiveNow.getTime() + 24 * 60 * 60 * 1000);
  const students = await db('students')
    .where({ wa_daily_enabled: true, is_banned: false })
    .where(function () { this.whereNull('wa_paused_until').orWhere('wa_paused_until', '<', effectiveNow); })
    .select('id', 'wa_anchor_time');

  let enqueued = 0;
  let skipped = 0;
  for (const student of students) {
    if (!student.wa_anchor_time) {
      const candidate = pickAnchorTime(rng);
      const updated = await db('students')
        .where('id', student.id)
        .update({ wa_anchor_time: db.raw('COALESCE(wa_anchor_time, ?)', [candidate]) })
        .returning('wa_anchor_time');
      student.wa_anchor_time = updated[0]?.wa_anchor_time || candidate;
    }
    const lede = await pickLede(student.id);
    if (!lede.type) { skipped += 1; continue; }
    const markets = await selectMarketsForUser(student.id, lede.payload);
    if (markets.length === 0) { skipped += 1; continue; }
    const scheduledFor = jitterScheduledFor(student.wa_anchor_time, targetDate, rng);
    await db('whatsapp_daily_queue').insert({
      student_id: student.id,
      scheduled_for: scheduledFor,
      lede_type: lede.type,
      lede_payload: JSON.stringify(lede.payload),
      markets: JSON.stringify(markets),
      status: 'pending',
    });
    enqueued += 1;
  }
  return { enqueued, skipped };
}

module.exports = { buildDailyQueue, pickAnchorTime, jitterScheduledFor };
