const studentsService = require('../../modules/students/students.service');
const { VALID_CATEGORIES, VALID_LEVELS } = require('../../modules/students/students.validation');
const { bold, numberedList } = require('../formatters');

const UNILORIN_FACULTIES = [
  'Agriculture',
  'Arts',
  'Communication and Information Sciences',
  'Education',
  'Engineering and Technology',
  'Environmental Sciences',
  'Law',
  'Life Sciences',
  'Management Sciences',
  'Pharmaceutical Sciences',
  'Physical Sciences',
  'Social Sciences',
  'Veterinary Medicine',
];

const CATEGORY_LABELS = {
  scholarships: 'Scholarships & Grants',
  entertainment: 'Entertainment & Lifestyle',
  tech: 'Tech & Innovation',
  sports: 'Sports',
  campus_news: 'Campus News & Events',
  career: 'Career & Jobs',
  health: 'Health & Wellness',
  academic: 'Academic Resources',
};

async function handleOnboardingStep(sock, jid, text, phone, getState, setState, clearState) {
  const state = getState(jid);

  // First message — welcome
  if (!state) {
    await sock.sendMessage(jid, {
      text: [
        `${bold('Welcome to Iroyinayo!')} 🎓`,
        '',
        "I'm your personal info bot for University of Ilorin. I deliver personalized content, quizzes, prediction markets, and rewards — all right here in WhatsApp.",
        '',
        "Let's get you set up. What's your name or nickname?",
      ].join('\n'),
    });
    setState(jid, 'onboarding', 'name', { phone });
    return;
  }

  if (state.step === 'name') {
    const name = text.trim();
    if (name.length < 2 || name.length > 50) {
      await sock.sendMessage(jid, { text: 'Please enter a valid name (2-50 characters).' });
      return;
    }
    state.data.name = name;
    await sock.sendMessage(jid, {
      text: `Nice to meet you, ${bold(name)}! 👋\n\nWhat faculty are you in?\n\n${numberedList(UNILORIN_FACULTIES)}\n\nReply with the number.`,
    });
    setState(jid, 'onboarding', 'faculty', state.data);
    return;
  }

  if (state.step === 'faculty') {
    const num = parseInt(text, 10);
    if (isNaN(num) || num < 1 || num > UNILORIN_FACULTIES.length) {
      await sock.sendMessage(jid, { text: `Please reply with a number between 1 and ${UNILORIN_FACULTIES.length}.` });
      return;
    }
    state.data.faculty = UNILORIN_FACULTIES[num - 1];
    const levels = VALID_LEVELS.map((l) => l === 'postgrad' ? 'Postgraduate' : `${l} Level`);
    await sock.sendMessage(jid, {
      text: `${bold(state.data.faculty)} — great!\n\nWhat level are you?\n\n${numberedList(levels)}\n\nReply with the number.`,
    });
    setState(jid, 'onboarding', 'level', state.data);
    return;
  }

  if (state.step === 'level') {
    const num = parseInt(text, 10);
    if (isNaN(num) || num < 1 || num > VALID_LEVELS.length) {
      await sock.sendMessage(jid, { text: `Please reply with a number between 1 and ${VALID_LEVELS.length}.` });
      return;
    }
    state.data.level = VALID_LEVELS[num - 1];
    const categoryList = Object.values(CATEGORY_LABELS);
    await sock.sendMessage(jid, {
      text: [
        "Almost done! Pick the topics you're interested in.",
        '',
        numberedList(categoryList),
        '',
        `Reply with the numbers separated by commas (e.g. ${bold('1,3,5')}).`,
      ].join('\n'),
    });
    setState(jid, 'onboarding', 'interests', state.data);
    return;
  }

  if (state.step === 'interests') {
    const categoryKeys = Object.keys(CATEGORY_LABELS);
    const nums = text.split(',').map((s) => parseInt(s.trim(), 10));
    const invalid = nums.some((n) => isNaN(n) || n < 1 || n > categoryKeys.length);
    if (invalid || nums.length === 0) {
      await sock.sendMessage(jid, {
        text: `Please reply with valid numbers separated by commas (e.g. 1,3,5). Numbers must be between 1 and ${categoryKeys.length}.`,
      });
      return;
    }

    const selectedCategories = [...new Set(nums)].map((n) => categoryKeys[n - 1]);
    state.data.interests = selectedCategories;

    try {
      await studentsService.register({
        phone_number: state.data.phone,
        name: state.data.name,
        faculty: state.data.faculty,
        level: state.data.level,
        interests: state.data.interests,
      });

      const selectedLabels = selectedCategories.map((k) => CATEGORY_LABELS[k]);

      await sock.sendMessage(jid, {
        text: [
          `${bold("You're all set!")} 🎉`,
          '',
          `${bold('Name:')} ${state.data.name}`,
          `${bold('Faculty:')} ${state.data.faculty}`,
          `${bold('Level:')} ${state.data.level}`,
          `${bold('Interests:')} ${selectedLabels.join(', ')}`,
          '',
          "Here's what to expect:",
          '• Daily personalized content based on your interests',
          '• Quizzes to earn points',
          '• Prediction markets to test your knowledge',
          '• Redeem points for airtime and data',
          '',
          `Type ${bold('menu')} to see all commands.`,
        ].join('\n'),
      });

      clearState(jid);
    } catch (err) {
      await sock.sendMessage(jid, { text: `Registration failed: ${err.message}. Please try again.` });
      clearState(jid);
    }
    return;
  }
}

module.exports = { handleOnboardingStep, UNILORIN_FACULTIES, CATEGORY_LABELS };
