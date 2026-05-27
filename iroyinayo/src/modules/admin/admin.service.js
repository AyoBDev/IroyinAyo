const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../../utils/errors');

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function register({ email, password, name, role, phone_number }) {
  const existing = await db('admins').where({ email }).first();
  if (existing) throw new ValidationError('Email already registered');
  const password_hash = await bcrypt.hash(password, 10);
  const [admin] = await db('admins')
    .insert({ email, password_hash, name, role: role || 'moderator', phone_number })
    .returning(['id', 'email', 'name', 'role', 'phone_number', 'created_at']);
  return admin;
}

async function login(email, password) {
  const admin = await db('admins').where({ email }).first();
  if (!admin) throw new UnauthorizedError('Invalid credentials');
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');
  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

async function getAnalytics() {
  const totalStudents = await db('students').count('id as count').first();
  const activeToday = await db('streaks')
    .where('last_active_date', new Date().toISOString().slice(0, 10))
    .count('id as count').first();
  const totalPointsIssued = await db('point_transactions')
    .where('amount', '>', 0).sum('amount as total').first();
  const totalRedemptions = await db('redemptions').count('id as count').first();
  const pendingRedemptions = await db('redemptions')
    .where({ status: 'pending' }).count('id as count').first();
  const openMarkets = await db('markets')
    .where({ status: 'open', is_approved: true }).count('id as count').first();

  return {
    total_students: Number(totalStudents.count),
    active_today: Number(activeToday.count),
    total_points_issued: Number(totalPointsIssued.total || 0),
    total_redemptions: Number(totalRedemptions.count),
    pending_redemptions: Number(pendingRedemptions.count),
    open_markets: Number(openMarkets.count),
  };
}

async function getDashboardKPIs() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Core engagement metrics
  const totalStudents = await db('students').count('id as count').first();
  const weeklyActiveUsers = await db('students')
    .join('point_transactions', 'students.id', 'point_transactions.student_id')
    .where('point_transactions.created_at', '>', weekAgo)
    .countDistinct('students.id as count')
    .first();
  const prevWeekActiveUsers = await db('students')
    .join('point_transactions', 'students.id', 'point_transactions.student_id')
    .where('point_transactions.created_at', '>', twoWeeksAgo)
    .where('point_transactions.created_at', '<=', weekAgo)
    .countDistinct('students.id as count')
    .first();

  // Predictions this week vs last
  const weeklyPredictions = await db('multi_market_positions')
    .where('created_at', '>', weekAgo)
    .count('id as count')
    .first();
  const prevWeekPredictions = await db('multi_market_positions')
    .where('created_at', '>', twoWeeksAgo)
    .where('created_at', '<=', weekAgo)
    .count('id as count')
    .first();

  // Points volume
  const weeklyPointsVolume = await db('multi_market_positions')
    .where('created_at', '>', weekAgo)
    .sum('amount as total')
    .first();

  // Retention: users active this week who were also active last week
  const retainedUsers = await db.raw(`
    SELECT COUNT(DISTINCT this_week.student_id) as count FROM
    (SELECT DISTINCT student_id FROM point_transactions WHERE created_at > ?) as this_week
    INNER JOIN
    (SELECT DISTINCT student_id FROM point_transactions WHERE created_at > ? AND created_at <= ?) as last_week
    ON this_week.student_id = last_week.student_id
  `, [weekAgo, twoWeeksAgo, weekAgo]);
  const retentionRate = parseInt(prevWeekActiveUsers?.count || 0, 10) > 0
    ? Math.round((parseInt(retainedUsers.rows[0]?.count || 0, 10) / parseInt(prevWeekActiveUsers.count, 10)) * 100)
    : 0;

  // New signups this week
  const weeklySignups = await db('students')
    .where('created_at', '>', weekAgo)
    .count('id as count')
    .first();

  // Sponsored market performance
  const sponsoredMarkets = await db('multi_markets')
    .where({ is_sponsored: true })
    .select('id', 'title', 'sponsor_name', 'is_featured', 'status', 'created_at');

  const sponsoredPerformance = await Promise.all(sponsoredMarkets.map(async (market) => {
    const predictions = await db('multi_market_positions')
      .where({ market_id: market.id })
      .count('id as count')
      .first();
    const uniquePredictors = await db('multi_market_positions')
      .where({ market_id: market.id })
      .countDistinct('student_id as count')
      .first();
    const totalVolume = await db('multi_market_positions')
      .where({ market_id: market.id })
      .sum('amount as total')
      .first();
    return {
      ...market,
      total_predictions: parseInt(predictions?.count || 0, 10),
      unique_predictors: parseInt(uniquePredictors?.count || 0, 10),
      points_volume: parseInt(totalVolume?.total || 0, 10),
    };
  }));

  // Daily activity for the past 14 days (for charts)
  const dailyActivity = await db.raw(`
    SELECT DATE(created_at) as date,
           COUNT(*) as predictions,
           COUNT(DISTINCT student_id) as unique_users,
           SUM(amount) as volume
    FROM multi_market_positions
    WHERE created_at > ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [twoWeeksAgo]);

  // Daily signups for the past 14 days
  const dailySignups = await db.raw(`
    SELECT DATE(created_at) as date, COUNT(*) as signups
    FROM students
    WHERE created_at > ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [twoWeeksAgo]);

  // Market engagement (avg predictions per market)
  const openMarketCount = await db('multi_markets')
    .where({ status: 'open' })
    .count('id as count')
    .first();
  const avgPredictionsPerMarket = parseInt(openMarketCount?.count || 0, 10) > 0
    ? Math.round(parseInt(weeklyPredictions?.count || 0, 10) / parseInt(openMarketCount.count, 10))
    : 0;

  return {
    overview: {
      total_users: parseInt(totalStudents?.count || 0, 10),
      weekly_active_users: parseInt(weeklyActiveUsers?.count || 0, 10),
      wau_change: parseInt(weeklyActiveUsers?.count || 0, 10) - parseInt(prevWeekActiveUsers?.count || 0, 10),
      weekly_predictions: parseInt(weeklyPredictions?.count || 0, 10),
      predictions_change: parseInt(weeklyPredictions?.count || 0, 10) - parseInt(prevWeekPredictions?.count || 0, 10),
      weekly_points_volume: parseInt(weeklyPointsVolume?.total || 0, 10),
      retention_rate: retentionRate,
      weekly_signups: parseInt(weeklySignups?.count || 0, 10),
      avg_predictions_per_market: avgPredictionsPerMarket,
      open_markets: parseInt(openMarketCount?.count || 0, 10),
    },
    sponsored: sponsoredPerformance,
    charts: {
      daily_activity: dailyActivity.rows || [],
      daily_signups: dailySignups.rows || [],
    },
  };
}

async function banStudent(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');
  await db('students').where({ id: studentId }).update({ is_banned: true });
  return db('students').where({ id: studentId }).first();
}

async function unbanStudent(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');
  await db('students').where({ id: studentId }).update({ is_banned: false });
  return db('students').where({ id: studentId }).first();
}

module.exports = { register, login, getAnalytics, getDashboardKPIs, banStudent, unbanStudent };
