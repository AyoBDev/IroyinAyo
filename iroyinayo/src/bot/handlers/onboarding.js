const studentsService = require('../../modules/students/students.service');
const db = require('../../config/database');
const { bold, numberedList, formatQuiz } = require('../formatters');

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
        "I'm your personal info bot. Get personalized content, earn points through quizzes, predict outcomes in markets, and redeem rewards — all right here in WhatsApp.",
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

    const categoryList = Object.values(CATEGORY_LABELS);
    await sock.sendMessage(jid, {
      text: [
        `Nice to meet you, ${bold(name)}! 👋`,
        '',
        "Pick the topics you're interested in:",
        '',
        numberedList(categoryList),
        '',
        `Reply with numbers separated by commas (e.g. ${bold('1,3,5')}).`,
        `Or reply ${bold('all')} to subscribe to everything.`,
      ].join('\n'),
    });
    setState(jid, 'onboarding', 'interests', state.data);
    return;
  }

  if (state.step === 'interests') {
    const categoryKeys = Object.keys(CATEGORY_LABELS);
    let selectedCategories;

    if (text.trim().toLowerCase() === 'all') {
      selectedCategories = [...categoryKeys];
    } else {
      const nums = text.split(',').map((s) => parseInt(s.trim(), 10));
      const invalid = nums.some((n) => isNaN(n) || n < 1 || n > categoryKeys.length);
      if (invalid || nums.length === 0) {
        await sock.sendMessage(jid, {
          text: `Please reply with valid numbers (1-${categoryKeys.length}) separated by commas, or ${bold('all')} for everything.`,
        });
        return;
      }
      selectedCategories = [...new Set(nums)].map((n) => categoryKeys[n - 1]);
    }

    state.data.interests = selectedCategories;

    try {
      await studentsService.register({
        phone_number: state.data.phone,
        name: state.data.name,
        interests: state.data.interests,
      });

      const selectedLabels = selectedCategories.map((k) => CATEGORY_LABELS[k]);

      await sock.sendMessage(jid, {
        text: [
          `${bold("You're all set!")} 🎉`,
          '',
          `${bold('Name:')} ${state.data.name}`,
          `${bold('Interests:')} ${selectedLabels.join(', ')}`,
          '',
          "Here's what you can do:",
          '📬 Daily personalized content based on your interests',
          '🧠 Quizzes to earn points',
          '📊 Prediction markets to test your knowledge',
          '🎁 Redeem points for airtime and data',
          '',
          `Type ${bold('menu')} to see all commands.`,
        ].join('\n'),
      });

      // Serve a first quiz immediately so the user experiences the core loop
      const quiz = await db('quizzes').orderByRaw('RANDOM()').first();
      if (quiz) {
        await sock.sendMessage(jid, {
          text: `\n🎯 ${bold("Let's start with your first quiz!")} Earn ${bold('10 pts')} right away:\n\n${formatQuiz(quiz)}`,
        });
        setState(jid, 'quiz', 'answering', { quizId: quiz.id });
      } else {
        clearState(jid);
      }
    } catch (err) {
      await sock.sendMessage(jid, { text: `Registration failed: ${err.message}. Please try again.` });
      clearState(jid);
    }
    return;
  }
}

module.exports = { handleOnboardingStep, CATEGORY_LABELS };
