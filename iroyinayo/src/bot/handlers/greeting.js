const gamificationService = require('../../modules/gamification/gamification.service');
const db = require('../../config/database');
const { bold } = require('../formatters');

async function handleWelcomeBack(sock, jid, student) {
  const { balance } = await gamificationService.getPointsBalance(student.id);

  // Check for pending quizzes (quizzes student hasn't answered today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const answeredToday = await db('quiz_answers')
    .where({ student_id: student.id })
    .where('created_at', '>=', todayStart)
    .count('id as count')
    .first();
  const quizzesAnswered = parseInt(answeredToday?.count || 0, 10);

  // Check active predictions
  const activePredictions = await db('market_positions')
    .join('markets', 'market_positions.market_id', 'markets.id')
    .where({ 'market_positions.student_id': student.id, 'markets.status': 'open' })
    .count('market_positions.id as count')
    .first();
  const predictionCount = parseInt(activePredictions?.count || 0, 10);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '☀️ Good morning' : hour < 17 ? '🌤️ Good afternoon' : '🌙 Good evening';

  const lines = [
    `${bold(`${greeting}, ${student.name}!`)}`,
    '',
    `💰 ${bold('Points:')} ${balance} pts`,
  ];

  if (quizzesAnswered === 0) {
    lines.push(`🧠 ${bold('Quiz:')} You haven't taken a quiz today — type ${bold('quiz')} to earn points!`);
  } else {
    lines.push(`🧠 ${bold('Quiz:')} ${quizzesAnswered} answered today ✅`);
  }

  if (predictionCount > 0) {
    lines.push(`📊 ${bold('Predictions:')} ${predictionCount} active`);
  }

  lines.push(
    '',
    `Type ${bold('menu')} to see all commands 📋`
  );

  await sock.sendMessage(jid, { text: lines.join('\n') });
}

module.exports = { handleWelcomeBack };
