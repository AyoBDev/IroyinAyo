require('dotenv').config();
const { createConnection } = require('./connection');
const { handleMessage } = require('./hackathonMessageHandler');

async function startBot() {
  console.log('Starting Hackathon Prediction Market bot...');
  const sock = await createConnection(handleMessage);
  return sock;
}

startBot().catch(console.error);
