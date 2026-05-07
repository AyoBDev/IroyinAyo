const gamificationService = require('../../modules/gamification/gamification.service');
const { formatPoints, bold } = require('../formatters');

async function handlePoints(sock, jid, student) {
  const { balance } = await gamificationService.getPointsBalance(student.id);
  const history = await gamificationService.getTransactionHistory(student.id, 5);

  const lines = [formatPoints(balance)];

  if (history.length > 0) {
    lines.push('', `${bold('📜 Recent Activity:')}`);
    for (const tx of history) {
      const sign = tx.amount > 0 ? '+' : '';
      const icon = tx.amount > 0 ? '🟢' : '🔴';
      lines.push(`${icon} ${sign}${tx.amount} pts — ${tx.description || tx.type}`);
    }
  }

  await sock.sendMessage(jid, { text: lines.join('\n') });
}

module.exports = { handlePoints };
