const studentsService = require('../../modules/students/students.service');
const { VALID_CATEGORIES } = require('../../modules/students/students.validation');
const { CATEGORY_LABELS } = require('./onboarding');
const { bold, numberedList } = require('../formatters');

async function handleInterests(sock, jid, student, setState) {
  const categoryList = Object.values(CATEGORY_LABELS);
  const currentLabels = student.interests.map((k) => CATEGORY_LABELS[k] || k);

  await sock.sendMessage(jid, {
    text: [
      `${bold('📌 Update Interests')}`,
      '',
      `Current: ${currentLabels.join(', ')}`,
      '',
      'Available categories:',
      numberedList(categoryList),
      '',
      `Reply with new numbers separated by commas (e.g. ${bold('1,3,5')}).`,
      `Type ${bold('back')} to cancel.`,
    ].join('\n'),
  });

  setState(jid, 'interests', 'selecting', {});
}

async function handleInterestsSelection(sock, jid, text, student, state, setState, clearState) {
  if (text.toLowerCase() === 'back') {
    clearState(jid);
    await sock.sendMessage(jid, { text: 'Cancelled. Type *menu* for options.' });
    return;
  }

  const categoryKeys = Object.keys(CATEGORY_LABELS);
  const nums = text.split(',').map((s) => parseInt(s.trim(), 10));
  const invalid = nums.some((n) => isNaN(n) || n < 1 || n > categoryKeys.length);

  if (invalid || nums.length === 0) {
    await sock.sendMessage(jid, { text: `Please reply with valid numbers (1-${categoryKeys.length}) separated by commas.` });
    return;
  }

  const selectedCategories = [...new Set(nums)].map((n) => categoryKeys[n - 1]);

  try {
    await studentsService.updateInterests(student.id, selectedCategories);
    const selectedLabels = selectedCategories.map((k) => CATEGORY_LABELS[k]);
    await sock.sendMessage(jid, {
      text: `✅ Interests updated!\n\nNew interests: ${bold(selectedLabels.join(', '))}`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }

  clearState(jid);
}

module.exports = { handleInterests, handleInterestsSelection };
