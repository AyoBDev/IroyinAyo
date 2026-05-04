const { bold } = require('../formatters');

async function handleHelp(sock, jid) {
  await sock.sendMessage(jid, {
    text: [
      `${bold('ℹ Help — Iroyinayo Bot')}`,
      '',
      `${bold('What is Iroyinayo?')}`,
      'Your personal info bot for University of Ilorin. Get personalized content, earn points through quizzes, predict outcomes in markets, and redeem rewards.',
      '',
      `${bold('Commands:')}`,
      '• *menu* — See all options',
      '• *quiz* — Answer a quiz',
      '• *points* — Check your balance',
      '• *leaderboard* — Top students',
      '• *predict* — Prediction markets',
      '• *my predictions* — Your predictions',
      '• *redeem* — Get airtime/data',
      '• *interests* — Change your topics',
      '',
      `${bold('How points work:')}`,
      '• Correct quiz = 10 pts',
      '• 7-day streak = 25 pts bonus',
      '• 30-day streak = 100 pts bonus',
      '• Win predictions = variable',
      '',
      'Questions? Contact the admin.',
    ].join('\n'),
  });
}

module.exports = { handleHelp };
