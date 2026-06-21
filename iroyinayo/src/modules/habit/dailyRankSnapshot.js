const db = require('../../config/database');

async function snapshotDailyRanks({ date = new Date() } = {}) {
  // Use the same ranking logic as the existing leaderboard:
  // rank by current week's net_profit (sum of payout - amount over week-to-date positions),
  // ties broken by wins, then by points_balance.

  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const standings = await db('students as s')
    .leftJoin('multi_market_positions as p', function () {
      this.on('p.student_id', '=', 's.id').andOnVal('p.created_at', '>=', weekStart);
    })
    .where('s.is_system', false)
    .where('s.is_banned', false)
    .groupBy('s.id', 's.points_balance')
    .select(
      's.id as student_id',
      's.points_balance',
      db.raw('COALESCE(SUM(p.payout - p.amount), 0)::int as net_profit'),
      db.raw('COALESCE(SUM(CASE WHEN p.payout > 0 THEN 1 ELSE 0 END), 0)::int as wins')
    )
    .orderBy('net_profit', 'desc')
    .orderBy('wins', 'desc')
    .orderBy('s.points_balance', 'desc');

  const rows = standings.map((s, i) => ({
    student_id: s.student_id,
    rank: i + 1,
    snapshot_date: today,
    points_balance: s.points_balance,
    net_profit_week: s.net_profit,
  }));

  // Upsert: replace any existing snapshot for this date
  if (rows.length === 0) return { snapshotted: 0 };
  await db('daily_rank_snapshots').insert(rows).onConflict(['student_id', 'snapshot_date']).merge();
  return { snapshotted: rows.length };
}

module.exports = { snapshotDailyRanks };
