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
  const [marketsToResolve, pendingUserMarkets, pendingContent, simulationAlerts, marketReports, recentBansCount] = await Promise.all([
    safeCount('multi_markets', { status: 'closed' }),
    safeCount('multi_markets', { status: 'pending' }),
    safeCount('content', { status: 'pending' }),
    safeCount('simulation_alerts', { status: 'pending' }),
    safeCount('market_reports', { resolution_status: 'pending' }),
    db('students').where({ is_banned: true }).count('* as c').first().then((r) => Number(r.c) || 0),
  ]);

  const pendingRedemptions = (await tableExists('redemptions'))
    ? await safeCount('redemptions', { status: 'pending' })
    : 0;

  const winnerRow = await db('weekly_leaderboards')
    .orderBy('week_start', 'desc')
    .first();
  const weeklyWinnerUnpaid = winnerRow ? !winnerRow.prize_paid : false;

  const totalsManageStrip = {
    markets: await safeCount('multi_markets'),
    students: await safeCount('students'),
    quizzes: (await tableExists('quizzes')) ? await safeCount('quizzes') : 0,
    schedules: (await tableExists('scheduled_markets')) ? await safeCount('scheduled_markets') : 0,
    ambassadors: 0, // ambassador table name varies; fill in when known
    liquidityConfigs: (await tableExists('market_liquidity_config')) ? await safeCount('market_liquidity_config') : 0,
    content: (await tableExists('content')) ? await safeCount('content') : 0,
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
