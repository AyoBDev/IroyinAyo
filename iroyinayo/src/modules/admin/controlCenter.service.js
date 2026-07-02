const db = require('../../config/database');

async function safeCount(table, where = {}) {
  try {
    const row = await db(table).where(where).count('* as c').first();
    return Number(row.c) || 0;
  } catch (_) {
    return 0;
  }
}

async function tableExists(name) {
  const r = await db.raw(
    `SELECT 1 FROM information_schema.tables WHERE table_name = ? LIMIT 1`,
    [name]
  );
  return r.rows.length > 0;
}

async function getSummary() {
  const [
    marketsToResolve,
    pendingUserMarkets,
    pendingContentExists, pendingContentVal,
    pendingRedemptionsExists, pendingRedemptionsVal,
    simulationAlerts,
    marketReports,
    recentBansCount,
    winnerRow,
    totalMarkets,
    totalStudents,
    totalQuizzesExists, totalQuizzes,
    totalSchedulesExists, totalSchedules,
    totalLiquidityExists, totalLiquidity,
    totalContentExists, totalContent,
    totalCirclesExists, totalCircles,
  ] = await Promise.all([
    safeCount('multi_markets', { status: 'closed' }),
    safeCount('multi_markets', { status: 'pending' }),
    tableExists('content'), safeCount('content', { status: 'pending' }),
    tableExists('redemptions'), safeCount('redemptions', { status: 'pending' }),
    safeCount('simulation_alerts', { status: 'pending' }),
    safeCount('market_reports', { resolution_status: 'pending' }),
    db('students').where({ is_banned: true }).count('* as c').first().then((r) => Number(r.c) || 0).catch(() => 0),
    db('weekly_leaderboards').orderBy('week_start', 'desc').first().catch(() => null),
    safeCount('multi_markets'),
    safeCount('students'),
    tableExists('quizzes'), safeCount('quizzes'),
    tableExists('scheduled_markets'), safeCount('scheduled_markets'),
    tableExists('market_liquidity_config'), safeCount('market_liquidity_config'),
    tableExists('content'), safeCount('content'),
    tableExists('circles'), db('circles').whereNull('deleted_at').count('* as c').first().then((r) => Number(r.c) || 0).catch(() => 0),
  ]);

  const pendingContent = pendingContentExists ? pendingContentVal : 0;
  const pendingRedemptions = pendingRedemptionsExists ? pendingRedemptionsVal : 0;
  const weeklyWinnerUnpaid = winnerRow ? !winnerRow.prize_paid : false;
  const totalsManageStrip = {
    markets: totalMarkets,
    students: totalStudents,
    circles: totalCirclesExists ? totalCircles : 0,
    quizzes: totalQuizzesExists ? totalQuizzes : 0,
    schedules: totalSchedulesExists ? totalSchedules : 0,
    ambassadors: 0,
    liquidityConfigs: totalLiquidityExists ? totalLiquidity : 0,
    content: totalContentExists ? totalContent : 0,
  };

  return {
    marketsToResolve,
    pendingUserMarkets,
    pendingContent,
    pendingRedemptions,
    simulationAlerts,
    marketReports,
    recentBansCount,
    weeklyWinnerUnpaid,
    totalsManageStrip,
  };
}

function startOfTodayWat() {
  // WAT is UTC+1. Compute today's 00:00 in WAT as a UTC Date.
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000); // shift to WAT clock
  wat.setUTCHours(0, 0, 0, 0);
  return new Date(wat.getTime() - 60 * 60 * 1000); // back to UTC
}

async function getHealth() {
  const dayStart = startOfTodayWat();

  const queueAgg = await db('whatsapp_daily_queue')
    .where('scheduled_for', '>=', dayStart)
    .select('status')
    .count('* as c')
    .groupBy('status');
  const todayQueue = { sent: 0, failed: 0, skipped: 0, pending: 0 };
  for (const r of queueAgg) {
    if (todayQueue[r.status] !== undefined) todayQueue[r.status] = Number(r.c);
  }

  const openMarketsCount = await safeCount('multi_markets', { status: 'open' });

  const dauToday = await db('students')
    .where('last_app_open_at', '>=', dayStart)
    .count('* as c')
    .first()
    .then((r) => Number(r.c) || 0)
    .catch(() => 0);

  const pendingPositionTriggers = (await tableExists('position_triggers'))
    ? await db('position_triggers').whereNull('fired_at').count('* as c').first().then((r) => Number(r.c) || 0)
    : 0;

  // Bot status: read from the in-process bot module's exported state.
  let botOnline = null;
  let botLastConnectedAt = null;
  try {
    const botSocket = require('../../bot/botSocket');
    if (typeof botSocket.getBotStatus === 'function') {
      const status = botSocket.getBotStatus();
      botOnline = !!status.connected;
      botLastConnectedAt = status.lastConnectedAt || null;
    } else if (typeof botSocket.getBotSocket === 'function') {
      botOnline = !!botSocket.getBotSocket();
    }
  } catch (_) { /* bot module not loaded; leave null */ }

  return { botOnline, botLastConnectedAt, todayQueue, openMarketsCount, dauToday, pendingPositionTriggers };
}

module.exports = { getSummary, getHealth };
