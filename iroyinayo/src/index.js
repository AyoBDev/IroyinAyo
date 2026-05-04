require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Iroyinayo API running on port ${PORT}`);

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
