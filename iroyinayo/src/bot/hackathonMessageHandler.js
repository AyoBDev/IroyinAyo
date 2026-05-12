const db = require('../config/database');
const gamificationService = require('../modules/gamification/gamification.service');
const { generateStudentToken } = require('../middleware/studentAuth');
const { handleMultiPredict, handleMultiPredictAction, handleMyBets } = require('./handlers/multiPredict');
const { handleHackathonAdmin } = require('./admin/hackathonAdmin');
const { formatLeaderboard, formatPoints, bold } = require('./formatters');

const conversationState = new Map();
const STARTING_POINTS = 100;

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

async function autoRegister(phone, jid) {
  const [student] = await db('students')
    .insert({
      phone_number: phone,
      name: phone,
      is_onboarded: true,
      points_balance: STARTING_POINTS,
    })
    .returning('*');

  await db('point_transactions').insert({
    student_id: student.id,
    amount: STARTING_POINTS,
    type: 'signup_bonus',
    description: 'Welcome bonus',
  });

  return student;
}

async function handleMessage(sock, jid, text, msg) {
  const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');

  if (text.startsWith('/') && ADMIN_NUMBERS.includes(phone)) {
    await handleHackathonAdmin(sock, jid, text);
    return;
  }

  let student = await db('students').where({ phone_number: phone }).first();

  if (!student) {
    student = await autoRegister(phone, jid);
    const webUrl = process.env.WEB_URL || 'https://iroyinmarket.up.railway.app';
    const token = generateStudentToken(student.id);
    await sock.sendMessage(jid, { text: `📱 You can also predict from your browser:\n${webUrl}?t=${token}` });
  }

  if (student.whatsapp_jid !== jid) {
    await db('students').where({ id: student.id }).update({ whatsapp_jid: jid });
  }

  const state = getState(jid);
  if (state && state.flow === 'predict') {
    await handleMultiPredictAction(sock, jid, text, student, state, setState, clearState);
    return;
  }

  const command = text.toLowerCase().trim();

  switch (command) {
    case 'leaderboard':
      const entries = await gamificationService.getLeaderboard('weekly', 10);
      await sock.sendMessage(jid, { text: formatLeaderboard(entries) });
      break;
    case 'my bets':
    case 'mybets':
    case 'my predictions':
      await handleMyBets(sock, jid, student);
      break;
    case 'balance':
    case 'points':
      const updated = await db('students').where({ id: student.id }).first();
      await sock.sendMessage(jid, { text: formatPoints(updated.points_balance) });
      break;
    case 'web':
    case 'link':
      const webUrl = process.env.WEB_URL || 'https://iroyinmarket.up.railway.app';
      const webToken = generateStudentToken(student.id);
      await sock.sendMessage(jid, { text: `📱 Predict on the web:\n${webUrl}?t=${webToken}` });
      break;
    default:
      await handleMultiPredict(sock, jid, student, setState);
      break;
  }
}

module.exports = { handleMessage, conversationState, getState, setState, clearState };
