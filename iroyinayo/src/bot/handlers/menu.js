const { bold } = require('../formatters');

async function handleMenu(sock, jid, student) {
  await sock.sendMessage(jid, {
    text: [
      `📋 ${bold('Menu')} — Hi ${student.name}!`,
      '',
      `📬 ${bold('info')} — Get your daily news feed`,
      `🧠 ${bold('quiz')} — Answer a quiz and earn points`,
      `💰 ${bold('points')} — Check your points balance`,
      `🏆 ${bold('leaderboard')} — See top students`,
      `📊 ${bold('predict')} — Browse prediction markets`,
      `🔮 ${bold('my predictions')} — View your predictions`,
      `🎁 ${bold('redeem')} — Spend points on airtime/data`,
      `📝 ${bold('interests')} — Update your interests`,
      `❓ ${bold('help')} — Get assistance`,
    ].join('\n'),
  });
}

module.exports = { handleMenu };
