const rewardsService = require('../../modules/rewards/rewards.service');
const { formatRewardOptions, bold } = require('../formatters');

async function handleRedeem(sock, jid, student, setState) {
  const options = await rewardsService.listActiveOptions();

  if (options.length === 0) {
    await sock.sendMessage(jid, { text: 'No rewards available right now. Check back later!' });
    return;
  }

  await sock.sendMessage(jid, { text: formatRewardOptions(options) });
  setState(jid, 'redeem', 'selecting', { options });
}

async function handleRedeemSelection(sock, jid, text, student, state, setState, clearState) {
  if (text.toLowerCase() === 'back') {
    clearState(jid);
    await sock.sendMessage(jid, { text: 'Cancelled. Type *menu* for options.' });
    return;
  }

  const num = parseInt(text, 10);
  const options = state.data.options;

  if (isNaN(num) || num < 1 || num > options.length) {
    await sock.sendMessage(jid, { text: `Reply with a number between 1 and ${options.length}, or ${bold('back')} to cancel.` });
    return;
  }

  const selected = options[num - 1];

  try {
    const result = await rewardsService.redeem(student.id, selected.id);
    await sock.sendMessage(jid, {
      text: [
        `✅ ${bold('Redemption submitted!')}`,
        '',
        `${bold('Reward:')} ${result.reward.name} (${result.reward.value})`,
        `${bold('Cost:')} ${result.reward.points_cost} pts`,
        `${bold('Status:')} Pending — you'll receive it shortly.`,
      ].join('\n'),
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }

  clearState(jid);
}

module.exports = { handleRedeem, handleRedeemSelection };
