require('dotenv').config();
const app = require('./app');

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

app.listen(PORT, async () => {
  console.log(`Iroyinayo API running on port ${PORT}`);

  await seedAdminFromEnv();

  if (process.env.ENABLE_BOT !== 'false') {
    try {
      const { createConnection } = require('./bot/connection');
      const { handleMessage } = require('./bot/messageHandler');
      const { startScheduler } = require('./bot/scheduler/dailyJobs');

      const sock = await createConnection(handleMessage);
      startScheduler(sock);
      console.log('WhatsApp bot started alongside API');
    } catch (err) {
      console.error('Bot startup failed:', err.message);
    }
  }
});
