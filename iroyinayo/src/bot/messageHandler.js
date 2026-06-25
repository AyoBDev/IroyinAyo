const studentsService = require('../modules/students/students.service');
const db = require('../config/database');
const { handleOnboardingStep } = require('./handlers/onboarding');
const { handleMenu } = require('./handlers/menu');
const { handleQuiz, handleQuizAnswer } = require('./handlers/quiz');
const { handlePoints } = require('./handlers/points');
const { handleLeaderboard } = require('./handlers/leaderboard');
const { handleInterests, handleInterestsSelection } = require('./handlers/interests');
const { handleRedeem, handleRedeemSelection } = require('./handlers/redeem');
const { handleHelp } = require('./handlers/help');
const { handleInfo } = require('./handlers/info');
const { handleWelcomeBack } = require('./handlers/greeting');
const { handleAdminCommand } = require('./admin/adminHandler');
const { handleDailyOptIn } = require('./handlers/dailyOptIn');

const GREETINGS = ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening', 'gm', 'whatsup', 'wassup', 'howdy', 'hola', 'hy'];

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

// Strip everything but digits so "+234 705 ..." or "234705...:5" all normalize the same.
function normalizePhone(value) {
  return (value || '').replace(/\D/g, '');
}

const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || '')
  .split(',')
  .map(normalizePhone)
  .filter(Boolean);

// Pull the phone digits from a WhatsApp JID. Returns '' for @lid JIDs since
// those are opaque linked-device IDs, not phone numbers.
function phoneFromJid(jid) {
  if (!jid) return '';
  if (jid.endsWith('@lid')) return '';
  const user = jid.split('@')[0] || '';
  const withoutDevice = user.split(':')[0];
  return normalizePhone(withoutDevice);
}

// Try the main JID first, then fall back to remoteJidAlt (Baileys exposes the
// phone-format JID there when the primary is @lid, and vice versa).
function resolveSenderPhone(jid, msg) {
  const fromJid = phoneFromJid(jid);
  if (fromJid) return fromJid;
  const altJid = msg?.key?.remoteJidAlt;
  return phoneFromJid(altJid);
}

async function handleMessage(sock, jid, text, msg) {
  const phone = resolveSenderPhone(jid, msg);
  const charCodes = Array.from(text).slice(0, 8).map((c) => c.charCodeAt(0)).join(',');
  console.log(`[handleMessage] phone=${phone || '(none)'} text="${text}" len=${text.length} firstCharCodes=${charCodes} startsWithSlash=${text.startsWith('/')} adminMatch=${ADMIN_NUMBERS.includes(phone)} adminList=[${ADMIN_NUMBERS.join(',')}]`);

  // Admin commands start with /
  if (text.startsWith('/')) {
    if (ADMIN_NUMBERS.includes(phone)) {
      await handleAdminCommand(sock, jid, text, msg);
      return;
    }
    console.log(`[admin] rejected /-command jid=${jid} alt=${msg?.key?.remoteJidAlt || '-'} normalized=${phone || '(none)'} (not in ADMIN_NUMBERS=${ADMIN_NUMBERS.join(',')})`);
  }

  // Check if student exists
  const student = await studentsService.getByPhone(phone);

  // If no student, start or continue onboarding
  if (!student || !student.is_onboarded) {
    await handleOnboardingStep(sock, jid, text, phone, getState, setState, clearState);
    return;
  }

  // Save WhatsApp JID for reliable messaging (LID or phone-based)
  if (student.whatsapp_jid !== jid) {
    await db('students').where({ id: student.id }).update({ whatsapp_jid: jid });
  }

  // Handle daily opt-in / PAUSE / STOP
  const optIn = await handleDailyOptIn({ phoneNumber: phone, text, sock });
  if (optIn.handled) return;

  // Check if student is banned
  if (student.is_banned) {
    await sock.sendMessage(jid, { text: '🚫 Your account has been suspended. Contact admin for help.' });
    return;
  }

  // Handle active conversation flows
  const state = getState(jid);
  if (state) {
    switch (state.flow) {
      case 'quiz':
        await handleQuizAnswer(sock, jid, text, student, state, setState, clearState);
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
    case 'redeem':
      await handleRedeem(sock, jid, student, setState);
      break;
    case 'info':
    case 'news':
      await handleInfo(sock, jid, student);
      break;
    case 'help':
      await handleHelp(sock, jid);
      break;
    default:
      if (GREETINGS.includes(command)) {
        await handleWelcomeBack(sock, jid, student);
        break;
      }
      await sock.sendMessage(jid, {
        text: `🤔 I didn't understand that. Type *menu* to see available commands or *help* for assistance.`,
      });
  }
}

module.exports = { handleMessage, conversationState, getState, setState, clearState };
