function bold(text) {
  return `*${text}*`;
}

function italic(text) {
  return `_${text}_`;
}

function mono(text) {
  return `\`\`\`${text}\`\`\``;
}

function numberedList(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function bulletList(items) {
  return items.map((item) => `• ${item}`).join('\n');
}

function formatPoints(balance) {
  return `💰 ${bold('Points Balance')}: ${balance} pts`;
}

function formatLeaderboard(entries) {
  if (entries.length === 0) return 'No leaderboard data yet.';
  const lines = entries.map(
    (e, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} ${e.name} — ${Number(e.total_points)} pts`
  );
  return `${bold('🏆 Leaderboard')}\n\n${lines.join('\n')}`;
}

function formatMarket(market) {
  const yesPercent = Math.round(market.yes_price * 100);
  const noPercent = Math.round(market.no_price * 100);
  return [
    `📌 ${bold(market.question)}`,
    `✅ Yes: ${yesPercent}¢ | ❌ No: ${noPercent}¢`,
    `${market.sponsor_bonus > 0 ? `🎁 Bonus: +${market.sponsor_bonus} pts | ` : ''}⏰ Closes: ${new Date(market.closes_at).toLocaleDateString('en-NG')}`,
    `🆔 ${market.id.slice(0, 8)}`,
  ].join('\n');
}

function formatMarketList(markets) {
  if (markets.length === 0) return 'No open markets right now.';
  return `${bold('📊 Open Prediction Markets')}\n\n${markets.map(formatMarket).join('\n\n')}`;
}

function formatQuiz(quiz) {
  const options = typeof quiz.options === 'string' ? JSON.parse(quiz.options) : quiz.options;
  const lines = [
    bold('🧠 Quiz Time!'),
    '',
    quiz.question,
    '',
    `A. ${options[0]}`,
    `B. ${options[1]}`,
    `C. ${options[2]}`,
    `D. ${options[3]}`,
    '',
    `Reply with ${bold('A')}, ${bold('B')}, ${bold('C')}, or ${bold('D')}`,
  ];
  return lines.join('\n');
}

function formatFeedItem(content) {
  const tag = content.categories && content.categories.length > 0
    ? `[${content.categories[0].toUpperCase()}] `
    : '';
  return `${tag}${bold(content.title)}\n${content.body}`;
}

function formatFeed(items) {
  if (items.length === 0) return "📭 No new content for you today. Check back later!";
  return `${bold('📬 Your Feed')}\n\n${items.map(formatFeedItem).join('\n\n---\n\n')}`;
}

function formatRewardOptions(options) {
  if (options.length === 0) return 'No rewards available right now.';
  const lines = options.map(
    (o, i) => `${i + 1}. ${bold(o.name)} — ${o.points_cost} pts (${o.value})`
  );
  return `${bold('🎁 Rewards')}\n\n${lines.join('\n')}\n\nReply with the number to redeem.`;
}

function formatPositions(positions) {
  if (positions.length === 0) return 'You have no active predictions.';
  const lines = positions.map((p) => {
    const status = p.market_status === 'resolved'
      ? (p.payout > 0 ? `✅ Won ${p.payout} pts` : '❌ Lost')
      : `⏳ ${p.side.toUpperCase()} — ${p.amount} pts (${p.shares?.toFixed(1) || '?'} shares)`;
    return `${bold(p.question)}\n${status}`;
  });
  return `${bold('🔮 My Predictions')}\n\n${lines.join('\n\n')}`;
}

module.exports = {
  bold, italic, mono, numberedList, bulletList,
  formatPoints, formatLeaderboard, formatMarket, formatMarketList,
  formatQuiz, formatFeedItem, formatFeed, formatRewardOptions, formatPositions,
};
