const { bold } = require('../formatters');

async function handleMenu(sock, jid, student) {
  // Try sending interactive list message
  try {
    const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');

    const msg = generateWAMessageFromContent(jid, {
      listMessage: {
        title: `📋 Menu — Hi ${student.name}!`,
        description: 'Choose a command below:',
        buttonText: '📋 Open Menu',
        listType: 1, // SINGLE_SELECT
        sections: [
          {
            title: '🎮 Activities',
            rows: [
              { title: '🧠 Quiz', description: 'Answer a quiz and earn points', rowId: 'quiz' },
              { title: '📊 Predict', description: 'Browse prediction markets', rowId: 'predict' },
              { title: '🔮 My Predictions', description: 'View your predictions', rowId: 'my predictions' },
            ],
          },
          {
            title: '💰 Rewards & Stats',
            rows: [
              { title: '💰 Points', description: 'Check your points balance', rowId: 'points' },
              { title: '🏆 Leaderboard', description: 'See top students', rowId: 'leaderboard' },
              { title: '🎁 Redeem', description: 'Spend points on airtime/data', rowId: 'redeem' },
            ],
          },
          {
            title: '⚙️ Settings',
            rows: [
              { title: '📝 Interests', description: 'Update your interests', rowId: 'interests' },
              { title: '❓ Help', description: 'Get assistance', rowId: 'help' },
            ],
          },
        ],
        footerText: 'Powered by Iroyinayo 🎓',
      },
    }, { userJid: jid });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  } catch {
    // Fallback to text menu if list message fails
    await sock.sendMessage(jid, {
      text: [
        `📋 ${bold('Menu')} — Hi ${student.name}!`,
        '',
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
}

module.exports = { handleMenu };
