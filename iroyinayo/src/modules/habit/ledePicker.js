const db = require('../../config/database');

const HOT_MARKET_MIN_PREDICTIONS = 50;
const SOCIAL_LOOKBACK_DAYS = 7;
const SOCIAL_RECENT_HOURS = 12;

async function rankLede(studentId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const rows = await db('daily_rank_snapshots')
    .where('student_id', studentId)
    .whereIn('snapshot_date', [today, yesterday])
    .select('snapshot_date', 'rank');
  if (rows.length < 2) return null;
  const todayRow = rows.find((r) => new Date(r.snapshot_date).getTime() === today.getTime());
  const yesterdayRow = rows.find((r) => new Date(r.snapshot_date).getTime() === yesterday.getTime());
  if (!todayRow || !yesterdayRow) return null;
  const delta = yesterdayRow.rank - todayRow.rank;
  if (Math.abs(delta) < 3) return null;
  return { type: 'rank', payload: { currentRank: todayRow.rank, rankDelta: delta } };
}

async function resolutionLede(studentId) {
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const positions = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('p.student_id', studentId)
    .where('m.status', 'open')
    .whereNotNull('m.closes_at')
    .where('m.closes_at', '<=', horizon)
    .where('m.closes_at', '>', new Date())
    .select('m.id', 'm.title');
  if (positions.length === 0) return null;
  return { type: 'resolution', payload: { count: positions.length, marketIds: positions.map((p) => p.id) } };
}

async function socialLede(studentId) {
  const lookback = new Date(Date.now() - SOCIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - SOCIAL_RECENT_HOURS * 60 * 60 * 1000);

  const match = await db('multi_market_positions as my_pos')
    .join('multi_market_positions as peer_pos', function() {
      this.on('my_pos.market_id', '=', 'peer_pos.market_id')
          .andOn('my_pos.outcome_id', '=', 'peer_pos.outcome_id');
    })
    .join('students as s', 'peer_pos.student_id', 's.id')
    .join('multi_markets as m', 'my_pos.market_id', 'm.id')
    .where('my_pos.student_id', studentId)
    .where('my_pos.created_at', '>=', lookback)
    .where('peer_pos.student_id', '!=', studentId)
    .where('peer_pos.created_at', '>=', recent)
    .where('s.is_system', false)
    .where('s.is_banned', false)
    .select('s.name as friendName', 'm.id as marketId', 'm.title as marketTitle')
    .first();

  if (!match) return null;
  return { type: 'social', payload: { friendName: match.friendName, marketId: match.marketId, marketTitle: match.marketTitle } };
}

async function curiosityLede() {
  const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const row = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('m.status', 'open')
    .where('p.created_at', '>=', lookback)
    .groupBy('m.id', 'm.title')
    .havingRaw('COUNT(p.id) > ?', [HOT_MARKET_MIN_PREDICTIONS])
    .orderByRaw('COUNT(p.id) DESC')
    .select('m.id as marketId', 'm.title as marketTitle')
    .first();
  if (!row) return null;
  return { type: 'curiosity', payload: { marketId: row.marketId, marketTitle: row.marketTitle } };
}

async function pickLede(studentId) {
  const r = await rankLede(studentId);
  if (r) return r;
  const res = await resolutionLede(studentId);
  if (res) return res;
  const soc = await socialLede(studentId);
  if (soc) return soc;
  const cur = await curiosityLede();
  if (cur) return cur;
  return { type: null, payload: null };
}

module.exports = { pickLede };
