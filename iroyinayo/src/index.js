require('dotenv').config();
const http = require('http');
const app = require('./app');
const { createSocketServer } = require('./socket');
const posthog = require('./utils/posthog');

async function seedAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) return;

  const bcrypt = require('bcrypt');
  const db = require('./config/database');

  try {
    const existing = await db('admins').where({ email }).first();
    if (existing) return;

    const password_hash = await bcrypt.hash(password, 10);
    const [admin] = await db('admins')
      .insert({ email, password_hash, name, role: 'super_admin' })
      .returning(['id', 'email', 'name', 'role']);

    console.log('Auto-seeded admin:', admin.email);
  } catch (err) {
    console.error('Admin seed failed:', err.message);
  }
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = createSocketServer(server);
app.set('io', io);

server.listen(PORT, async () => {
  console.log(`Hackathon Prediction Market API running on port ${PORT}`);

  try {
    const knex = require('./config/database');
    await knex.migrate.latest();
    console.log('Migrations complete');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }

  await seedAdminFromEnv();

  try {
    const { loadAllSchedules } = require('./modules/markets/scheduler.service');
    await loadAllSchedules();

    const cron = require('node-cron');
    const { finalizeWeek } = require('./modules/gamification/weeklyLeaderboard');
    cron.schedule('0 0 * * 1', () => {
      const lastSunday = new Date();
      lastSunday.setDate(lastSunday.getDate() - 1);
      finalizeWeek(lastSunday).catch(err => {
        console.error('[CRON] Weekly finalize failed:', err.message);
      });
    });
    console.log('[CRON] Weekly leaderboard finalize scheduled for Monday 00:00');

    const { issuePendingRefills } = require('./modules/refills/refill.service');
    cron.schedule('1 0 * * *', () => {
      issuePendingRefills().then(({ issued }) => {
        console.log(`[CRON] Daily refills issued: ${issued}`);
      }).catch(err => {
        console.error('[CRON] Daily refill issuance failed:', err.message);
      });
    }, { timezone: 'Africa/Lagos' });
    console.log('[CRON] Daily refill issuance scheduled for 00:01 WAT');
  } catch (err) {
    console.error('Scheduler startup failed:', err.message);
  }

  try {
    const { startScheduler: startSimulation } = require('./modules/simulation/scheduler');
    startSimulation(io);
    console.log('Simulation scheduler started');
  } catch (err) {
    console.error('Simulation scheduler failed to start:', err.message);
  }

  // Crews background jobs
  const crewsPools = require('./modules/crews/pools.service');
  const crewsResolution = require('./modules/crews/resolution.service');
  const crewsFixtures = require('./modules/crews/fixtures.service');

  setInterval(async () => {
    try { const r = await crewsPools.closeExpiredPools(); if (r.closed) console.log(`[crews] closed ${r.closed} pools`); }
    catch (e) { console.error('[crews] closeExpiredPools error:', e.message); }
  }, 60 * 1000); // 1 min

  setInterval(async () => {
    try { const r = await crewsResolution.processExpiredDisputeWindows(); if (r.resolved) console.log(`[crews] expired ${r.resolved} dispute windows`); }
    catch (e) { console.error('[crews] processExpiredDisputeWindows error:', e.message); }
  }, 60 * 60 * 1000); // 1 hour

  setInterval(async () => {
    try { const r = await crewsFixtures.pollCompletedFixtures(); if (r.resolved) console.log(`[crews] resolved ${r.resolved} fixtures`); }
    catch (e) { console.error('[crews] pollCompletedFixtures error:', e.message); }
  }, 15 * 60 * 1000); // 15 min

  setInterval(async () => {
    try { const r = await crewsFixtures.pollUpcomingFixtures(); if (r.ingested) console.log(`[crews] ingested ${r.ingested} fixtures`); }
    catch (e) { console.error('[crews] pollUpcomingFixtures error:', e.message); }
  }, 6 * 60 * 60 * 1000); // 6 hours


  if (process.env.ENABLE_BOT !== 'false') {
    try {
      const { createConnection } = require('./bot/connection');
      const { handleMessage } = require('./bot/hackathonMessageHandler');

      const { setBotSocket } = require('./bot/botSocket');
      const sock = await createConnection(handleMessage);
      setBotSocket(sock);
      console.log('WhatsApp bot started alongside API');
    } catch (err) {
      console.error('Bot startup failed:', err.message);
    }
  }
});

process.on('SIGINT', async () => {
  await posthog.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await posthog.shutdown();
  process.exit(0);
});
