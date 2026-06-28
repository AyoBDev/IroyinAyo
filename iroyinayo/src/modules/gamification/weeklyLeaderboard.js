const db = require('../../config/database');

const HIDDEN_LEADERBOARD_NAMES = ['AyoB'];

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function getMonthBounds(date = new Date()) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function buildStandings({ start, end, limit }) {
  let query = db('multi_market_positions')
    .join('students', 'multi_market_positions.student_id', 'students.id')
    .where('students.is_system', false)
    .whereNotIn('students.name', HIDDEN_LEADERBOARD_NAMES);

  if (start) query = query.where('multi_market_positions.created_at', '>=', start);
  if (end) query = query.where('multi_market_positions.created_at', '<=', end);

  const rows = await query
    .groupBy('students.id', 'students.name')
    .select(
      'students.id',
      'students.name',
      db.raw('COALESCE(SUM(multi_market_positions.payout - multi_market_positions.amount), 0) as net_profit'),
      db.raw('COALESCE(SUM(multi_market_positions.amount), 0) as total_wagered'),
      db.raw('COUNT(multi_market_positions.id) as predictions'),
      db.raw('SUM(CASE WHEN multi_market_positions.payout > 0 THEN 1 ELSE 0 END) as wins'),
      db.raw('COALESCE(SUM(CASE WHEN multi_market_positions.payout > 0 THEN multi_market_positions.payout ELSE 0 END), 0) as total_won')
    )
    .orderBy('wins', 'desc')
    .orderBy('total_won', 'desc')
    .orderBy('predictions', 'desc')
    .limit(limit);

  return rows.map((s, i) => ({
    rank: i + 1,
    id: s.id,
    name: s.name,
    netProfit: parseInt(s.net_profit, 10),
    totalWagered: parseInt(s.total_wagered, 10),
    totalWon: parseInt(s.total_won, 10),
    predictions: parseInt(s.predictions, 10),
    wins: parseInt(s.wins, 10),
  }));
}

async function getCurrentWeekStandings(limit = 20) {
  const { start, end } = getWeekBounds();
  return buildStandings({ start, end, limit });
}

async function getCurrentMonthStandings(limit = 20) {
  const { start, end } = getMonthBounds();
  return buildStandings({ start, end, limit });
}

async function getAllTimeStandings(limit = 20) {
  return buildStandings({ start: null, end: null, limit });
}

async function finalizeWeek(weekDate) {
  const { start, end } = getWeekBounds(weekDate);
  const weekStart = start.toISOString().slice(0, 10);
  const weekEnd = end.toISOString().slice(0, 10);

  const existing = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
  if (existing) return existing;

  const standings = await getCurrentWeekStandings(10);
  const winner = standings.length > 0 && standings[0].wins > 0 ? standings[0] : null;

  const [record] = await db('weekly_leaderboards')
    .insert({
      week_start: weekStart,
      week_end: weekEnd,
      winner_id: winner?.id || null,
      winner_name: winner?.name || null,
      winner_profit: winner?.totalWon || 0,
      standings: JSON.stringify(standings),
    })
    .returning('*');

  if (winner) {
    const { notifyWeeklyWinner } = require('../notifications/whatsapp');
    notifyWeeklyWinner(winner.id, weekStart).catch(() => {});
  }

  return record;
}

async function getPastWeeks(limit = 4) {
  return db('weekly_leaderboards')
    .orderBy('week_start', 'desc')
    .limit(limit);
}

async function getWeeklyRank(studentId) {
  const standings = await getCurrentWeekStandings(100);
  const entry = standings.find(s => s.id === studentId);
  return entry ? entry.rank : null;
}

async function getWeeklyStandingForStudent(studentId) {
  const standings = await getCurrentWeekStandings(1000);
  const entry = standings.find(s => s.id === studentId);
  if (!entry) {
    return { rank: null, wins: 0, totalWon: 0, predictions: 0 };
  }
  return {
    rank: entry.rank,
    wins: entry.wins,
    totalWon: entry.totalWon,
    predictions: entry.predictions,
  };
}

module.exports = {
  getWeekBounds,
  getMonthBounds,
  getCurrentWeekStandings,
  getCurrentMonthStandings,
  getAllTimeStandings,
  finalizeWeek,
  getPastWeeks,
  getWeeklyRank,
  getWeeklyStandingForStudent,
};
