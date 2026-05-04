const studentsService = require('../modules/students/students.service');
const { handleOnboardingStep } = require('./handlers/onboarding');
const { handleMenu } = require('./handlers/menu');
const { handleQuiz, handleQuizAnswer } = require('./handlers/quiz');
const { handlePoints } = require('./handlers/points');
const { handleLeaderboard } = require('./handlers/leaderboard');
const { handleInterests, handleInterestsSelection } = require('./handlers/interests');
const { handlePredict, handlePredictAction } = require('./handlers/predict');
const { handleRedeem, handleRedeemSelection } = require('./handlers/redeem');
const { handleHelp } = require('./handlers/help');
const { handleAdminCommand } = require('./admin/adminHandler');

// In-memory conversation state: jid -> { flow, step, data }
const conversationState = new Map();

function getState(jid) {
  return conversationState.get(jid) || null;
}

function setState(jid, flow, step, data = {}) {
  conversationState.set(jid, { flow, step, data });
}

function clearState(jid) {
  conversationState.delete(jid);
}

const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || '').split(',').filter(Boolean);

async function handleMessage(sock, jid, text, msg) {
  const phone = jid.replace('@s.whatsapp.net', '');

  // Admin commands start with /
  if (text.startsWith('/') && ADMIN_NUMBERS.includes(phone)) {
    await handleAdminCommand(sock, jid, text);
    return;
  }

  // Check if student exists
  const student = await studentsService.getByPhone(phone);

  // If no student, start or continue onboarding
  if (!student || !student.is_onboarded) {
    await handleOnboardingStep(sock, jid, text, phone, getState, setState, clearState);
    return;
  }

  // Check if student is banned
  if (student.is_banned) {
    await sock.sendMessage(jid, { text: 'Your account has been suspended. Contact admin for help.' });
    return;
  }

  // Handle active conversation flows
  const state = getState(jid);
  if (state) {
    switch (state.flow) {
      case 'quiz':
        await handleQuizAnswer(sock, jid, text, student, state, setState, clearState);
        return;
      case 'predict':
        await handlePredictAction(sock, jid, text, student, state, setState, clearState);
        return;
      case 'redeem':
        await handleRedeemSelection(sock, jid, text, student, state, setState, clearState);
        return;
      case 'interests':
        await handleInterestsSelection(sock, jid, text, student, state, setState, clearState);
        return;
    }
  }

  // Route commands
  const command = text.toLowerCase();

  switch (command) {
    case 'menu':
      await handleMenu(sock, jid, student);
      break;
    case 'quiz':
      await handleQuiz(sock, jid, student, setState);
      break;
    case 'points':
      await handlePoints(sock, jid, student);
      break;
    case 'leaderboard':
      await handleLeaderboard(sock, jid);
      break;
    case 'interests':
      await handleInterests(sock, jid, student, setState);
      break;
    case 'predict':
      await handlePredict(sock, jid, student, setState);
      break;
    case 'my predictions':
      const { handleMyPredictions } = require('./handlers/predict');
      await handleMyPredictions(sock, jid, student);
      break;
    case 'redeem':
      await handleRedeem(sock, jid, student, setState);
      break;
    case 'help':
      await handleHelp(sock, jid);
      break;
    default:
      await sock.sendMessage(jid, {
        text: `I didn't understand that. Type *menu* to see available commands or *help* for assistance.`,
      });
  }
}

module.exports = { handleMessage, conversationState, getState, setState, clearState };
