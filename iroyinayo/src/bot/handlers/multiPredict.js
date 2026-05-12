const multiMarkets = require('../../modules/markets/multiMarkets.service');
const { getIO } = require('../../socket');
const db = require('../../config/database');
const { formatMultiMarketList, formatMultiMarketOdds, formatMultiPositions, bold } = require('../formatters');

async function handleMultiPredict(sock, jid, student, setState) {
  const markets = await multiMarkets.listOpenMarkets();
  const text = formatMultiMarketList(markets);
  await sock.sendMessage(jid, { text });
  if (markets.length > 0) {
    setState(jid, 'predict', 'browsing', {});
  }
}

async function handleMultiPredictAction(sock, jid, text, student, state, setState, clearState) {
  const lower = text.toLowerCase().trim();

  if (lower === 'back' || lower === 'menu') {
    clearState(jid);
    const markets = await multiMarkets.listOpenMarkets();
    if (state.step === 'viewing') {
      await sock.sendMessage(jid, { text: formatMultiMarketList(markets) });
      setState(jid, 'predict', 'browsing', {});
    } else {
      await sock.sendMessage(jid, { text: formatMultiMarketList(markets) });
    }
    return;
  }

  if (state.step === 'browsing') {
    const num = parseInt(lower, 10);
    if (isNaN(num) || num < 1) {
      await sock.sendMessage(jid, { text: 'Reply with a market number, or type *back*.' });
      return;
    }

    const markets = await multiMarkets.listOpenMarkets();
    if (num > markets.length) {
      await sock.sendMessage(jid, { text: `Invalid number. Choose 1-${markets.length}.` });
      return;
    }

    const market = markets[num - 1];
    const full = await multiMarkets.getMarketWithOdds(market.id);
    await sock.sendMessage(jid, { text: formatMultiMarketOdds(full) });
    setState(jid, 'predict', 'viewing', { marketId: market.id });
    return;
  }

  if (state.step === 'viewing') {
    const betMatch = lower.match(/^bet\s+(\d+)\s+(\d+)$/);
    if (!betMatch) {
      await sock.sendMessage(jid, {
        text: `Reply: ${bold('bet [team#] [amount]')} or ${bold('back')} to return.`,
      });
      return;
    }

    const teamNum = parseInt(betMatch[1], 10);
    const amount = parseInt(betMatch[2], 10);
    const market = await multiMarkets.getMarketWithOdds(state.data.marketId);

    if (teamNum < 1 || teamNum > market.outcomes.length) {
      await sock.sendMessage(jid, { text: `Invalid team number. Choose 1-${market.outcomes.length}.` });
      return;
    }

    const outcome = market.outcomes[teamNum - 1];

    try {
      const result = await multiMarkets.buyPosition(market.id, outcome.id, student.id, amount);

      const io = getIO();
      if (io) {
        io.emit('odds:update', { marketId: market.id, outcomes: result.market.outcomes.map(o => ({ id: o.id, price: o.price })) });
        io.emit('bet:placed', { marketId: market.id, outcomeLabel: outcome.label, amount });
        const updatedBal = await db('students').where({ id: student.id }).first();
        io.to(`student:${student.id}`).emit('balance:update', { studentId: student.id, balance: updatedBal.points_balance });
      }

      const sharesReceived = result.position.shares.toFixed(1);
      const potentialPayout = Math.floor(result.position.shares);
      const profit = potentialPayout - amount;

      const newPrice = result.market.outcomes.find((o) => o.id === outcome.id);
      const cents = newPrice ? Math.round(newPrice.price * 100) : '?';

      await sock.sendMessage(jid, {
        text: [
          `✅ ${bold('Bet placed!')}`,
          '',
          `📌 ${bold('Market:')} ${market.title}`,
          `🎯 ${bold('Team:')} ${outcome.label}`,
          `💸 ${bold('Spent:')} ${amount} pts`,
          `📈 ${bold('Shares:')} ${sharesReceived}`,
          `🏆 ${bold('If they win:')} ${potentialPayout} pts (profit: ${profit} pts)`,
          `⚖️ ${bold('New odds:')} ${outcome.label} ${cents}¢`,
          '',
          `💰 ${bold('Balance:')} ${student.points_balance - amount} pts remaining`,
        ].join('\n'),
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ ${err.message}` });
    }

    clearState(jid);
    return;
  }
}

async function handleMyBets(sock, jid, student) {
  const positions = await multiMarkets.getStudentPositions(student.id);
  await sock.sendMessage(jid, { text: formatMultiPositions(positions) });
}

module.exports = { handleMultiPredict, handleMultiPredictAction, handleMyBets };
