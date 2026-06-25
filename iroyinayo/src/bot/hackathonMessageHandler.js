const db = require('../config/database');
const gamificationService = require('../modules/gamification/gamification.service');
const { handleMultiPredict, handleMultiPredictAction, handleMyPredictions } = require('./handlers/multiPredict');
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
    const webUrl = process.env.WEB_URL || 'https://iroyinayo-production.up.railway.app';
    await sock.sendMessage(jid, {
      text: [
        `${bold('Welcome to IroyinMarket! 🎯')}`,
        '',
        `You've been given ${bold('100 free points')} to start predicting.`,
        '',
        `${bold('How it works:')}`,
        `1. Pick a market (hackathon placements or football)`,
        `2. Predict an outcome with your points`,
        `3. If you're right, you win more points!`,
        '',
        `${bold('Commands:')}`,
        `• Send anything to see markets`,
        `• ${bold('predict [team#] [amount]')} — place a prediction`,
        `• ${bold('my predictions')} — view your positions`,
        `• ${bold('leaderboard')} — see top predictors`,
        `• ${bold('balance')} — check your points`,
        `• ${bold('web')} — get a link to predict in your browser`,
        '',
        `📱 You can also predict from your browser:`,
        `${webUrl}`,
      ].join('\n'),
    });
    return;
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
  const greetings = ['hi', 'hello', 'hey', 'start', 'menu', 'help', 'sup', 'yo'];

  if (greetings.includes(command)) {
    const webUrl = process.env.WEB_URL || 'https://iroyinayo-production.up.railway.app';
    const bal = student.points_balance;
    await sock.sendMessage(jid, {
      text: [
        `${bold('Welcome to IroyinMarket! 🎯')}`,
        '',
        `You have ${bold(bal + ' points')} to predict with.`,
        '',
        `${bold('Commands:')}`,
        `• ${bold('predict')} — see markets and place predictions`,
        `• ${bold('my predictions')} — view your positions`,
        `• ${bold('leaderboard')} — see top predictors`,
        `• ${bold('balance')} — check your points`,
        `• ${bold('web')} — predict in your browser`,
        '',
        `📱 Browser link:`,
        `${webUrl}`,
      ].join('\n'),
    });
    return;
  }

  switch (command) {
    case 'leaderboard':
      const entries = await gamificationService.getLeaderboard('weekly', 10);
      await sock.sendMessage(jid, { text: formatLeaderboard(entries) });
      break;
    case 'my bets':
    case 'mybets':
    case 'my predictions':
    case 'mypredictions':
      await handleMyPredictions(sock, jid, student);
      break;
    case 'balance':
    case 'points':
      const updated = await db('students').where({ id: student.id }).first();
      await sock.sendMessage(jid, { text: formatPoints(updated.points_balance) });
      break;
    case 'web':
    case 'link':
      const webUrl = process.env.WEB_URL || 'https://iroyinayo-production.up.railway.app';
      await sock.sendMessage(jid, { text: `📱 Predict on the web:\n${webUrl}` });
      break;
    case 'predict':
    case 'markets':
      await handleMultiPredict(sock, jid, student, setState);
      break;
    default:
      await sock.sendMessage(jid, {
        text: `I didn't get that. Type ${bold('hi')} for help or ${bold('predict')} to see markets.`,
      });
      break;
  }
}

module.exports = { handleMessage, conversationState, getState, setState, clearState };
