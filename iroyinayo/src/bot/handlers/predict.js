const marketsService = require('../../modules/markets/markets.service');
const { formatMarketList, formatPositions, bold } = require('../formatters');

async function handlePredict(sock, jid, student, setState) {
  const markets = await marketsService.listOpen();

  if (markets.length === 0) {
    await sock.sendMessage(jid, { text: '📊 No open markets right now. Check back later!' });
    return;
  }

  const text = [
    formatMarketList(markets),
    '',
    `💸 To bet, reply: ${bold('buy [market-id] [yes/no] [amount]')}`,
    `📝 Example: ${bold('buy a1b2c3d4 yes 50')}`,
    '',
    `💡 Or type ${bold('propose')} to suggest a new market.`,
  ].join('\n');

  await sock.sendMessage(jid, { text });
  setState(jid, 'predict', 'browsing', {});
}

async function handlePredictAction(sock, jid, text, student, state, setState, clearState) {
  const lower = text.toLowerCase().trim();

  if (lower === 'back' || lower === 'menu') {
    clearState(jid);
    await sock.sendMessage(jid, { text: '👋 Exited markets. Type *menu* for options.' });
    return;
  }

  // Handle: buy [id] [yes/no] [amount]
  const buyMatch = lower.match(/^buy\s+(\S+)\s+(yes|no)\s+(\d+)$/);
  if (buyMatch) {
    const [, idPrefix, side, amountStr] = buyMatch;
    const amount = parseInt(amountStr, 10);

    // Find market by ID prefix
    const markets = await marketsService.listOpen();
    const market = markets.find((m) => m.id.startsWith(idPrefix));

    if (!market) {
      await sock.sendMessage(jid, { text: '🔍 Market not found. Check the ID and try again.' });
      return;
    }

    try {
      const result = await marketsService.buyPosition(market.id, student.id, side, amount);
      const yesPercent = Math.round(result.market.yes_price * 100);
      const noPercent = Math.round(result.market.no_price * 100);

      const sharesReceived = result.position.shares.toFixed(1);
      const grossPayout = Math.floor(result.position.shares);
      const profit = grossPayout - amount;
      const fee = profit > 0 ? Math.floor(profit * 0.10) : 0;
      const netPayout = grossPayout - fee;

      await sock.sendMessage(jid, {
        text: [
          `✅ ${bold('Position placed!')}`,
          '',
          `📌 ${bold('Market:')} ${market.question}`,
          `🎯 ${bold('Side:')} ${side.toUpperCase()}`,
          `💸 ${bold('Spent:')} ${amount} pts`,
          `📈 ${bold('Shares:')} ${sharesReceived}`,
          `🏆 ${bold('If you win:')} ${netPayout} pts (profit: ${netPayout - amount} pts after 10% fee)`,
          `⚖️ ${bold('New odds:')} Yes ${yesPercent}¢ | No ${noPercent}¢`,
        ].join('\n'),
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ ${err.message}` });
    }

    clearState(jid);
    return;
  }

  // Handle: propose [question]
  if (lower.startsWith('propose ')) {
    const question = text.slice(8).trim();
    if (question.length < 10) {
      await sock.sendMessage(jid, { text: 'Question must be at least 10 characters.' });
      return;
    }

    const closesAt = new Date();
    closesAt.setDate(closesAt.getDate() + 7);

    try {
      await marketsService.create({
        question,
        closes_at: closesAt.toISOString(),
        created_by_type: 'student',
        created_by_id: student.id,
      });

      await sock.sendMessage(jid, {
        text: `✅ Your market proposal has been submitted for admin approval:\n\n${bold(question)}`,
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ ${err.message}` });
    }

    clearState(jid);
    return;
  }

  await sock.sendMessage(jid, {
    text: `Reply with:\n💸 ${bold('buy [id] [yes/no] [amount]')} to place a bet\n💡 ${bold('propose [question]')} to suggest a market\n🔙 ${bold('back')} to exit`,
  });
}

async function handleMyPredictions(sock, jid, student) {
  const positions = await marketsService.getStudentPositions(student.id);
  await sock.sendMessage(jid, { text: formatPositions(positions) });
}

module.exports = { handlePredict, handlePredictAction, handleMyPredictions };
