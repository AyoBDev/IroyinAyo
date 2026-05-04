require('dotenv').config();
const { createConnection } = require('./connection');
const { handleMessage } = require('./messageHandler');
const { startScheduler } = require('./scheduler/dailyJobs');

async function startBot() {
  console.log('Starting Iroyinayo bot...');
  const sock = await createConnection(handleMessage);
  startScheduler(sock);
  return sock;
}

startBot().catch(console.error);
