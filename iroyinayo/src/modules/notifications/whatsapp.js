const { getBotSocket } = require('../../bot/botSocket');
const db = require('../../config/database');

async function sendWhatsApp(phoneNumber, text) {
  const sock = getBotSocket();
  if (!sock) {
    console.log(`[NOTIFY] Bot offline. Message for ${phoneNumber}: ${text.slice(0, 50)}...`);
    return false;
  }

  try {
    const jid = `${phoneNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.log(`[NOTIFY] Send failed for ${phoneNumber}:`, err.message);
    return false;
  }
}

async function notifyMarketResolution(marketId, winnerLabel) {
  const positions = await db('multi_market_positions')
    .join('students', 'multi_market_positions.student_id', 'students.id')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .where('multi_market_positions.market_id', marketId)
    .select('students.phone_number', 'students.name', 'multi_market_positions.payout', 'multi_markets.title');

  for (const pos of positions) {
    const won = pos.payout > 0;
    const text = won
      ? `🏆 *${winnerLabel}* won "${pos.title}"!\n\nYou earned *+${pos.payout} pts*. Nice call! 🎯`
      : `"${pos.title}" resolved → *${winnerLabel}* won.\n\nBetter luck next time! Check new markets: ${process.env.APP_URL || 'iroyinmarket.com'}`;

    await sendWhatsApp(pos.phone_number, text);
  }
}

async function notifyWeeklyWinner(winnerId, weekStart) {
  const winner = await db('students').where({ id: winnerId }).first();
  if (!winner) return;

  const text = `🥇 Congratulations *${winner.name}*!\n\nYou're the #1 predictor this week on IroyinMarket! 🎉\n\nKeep your streak going → ${process.env.APP_URL || 'iroyinmarket.com'}`;
  await sendWhatsApp(winner.phone_number, text);

  const topPredictors = await db('students')
    .where('points_balance', '>', 0)
    .whereNot({ id: winnerId })
    .orderBy('points_balance', 'desc')
    .limit(20)
    .select('phone_number', 'name');

  for (const student of topPredictors) {
    const announcement = `📊 Weekly leaderboard reset!\n\n🥇 *${winner.name}* won this week.\n\nNew week, new chance. Make your predictions now → ${process.env.APP_URL || 'iroyinmarket.com'}`;
    await sendWhatsApp(student.phone_number, announcement);
  }
}

async function notifyNewMarket(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) return;

  const outcomes = await db('multi_market_outcomes').where({ market_id: marketId }).select('label');
  const optionsList = outcomes.slice(0, 5).map(o => `• ${o.label}`).join('\n');
  const moreText = outcomes.length > 5 ? `\n...and ${outcomes.length - 5} more` : '';

  const students = await db('students')
    .where({ is_verified: true })
    .select('phone_number');

  const text = `🔥 *New Market*\n\n"${market.title}"\n\n${optionsList}${moreText}\n\nPredict now → ${process.env.APP_URL || 'iroyinmarket.com'}`;

  for (const student of students) {
    await sendWhatsApp(student.phone_number, text);
  }
}

module.exports = { sendWhatsApp, notifyMarketResolution, notifyWeeklyWinner, notifyNewMarket };
