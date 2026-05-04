const gamificationService = require('../../modules/gamification/gamification.service');
const { formatLeaderboard } = require('../formatters');

async function handleLeaderboard(sock, jid) {
  const entries = await gamificationService.getLeaderboard('weekly', 10);
  await sock.sendMessage(jid, { text: formatLeaderboard(entries) });
}

module.exports = { handleLeaderboard };
