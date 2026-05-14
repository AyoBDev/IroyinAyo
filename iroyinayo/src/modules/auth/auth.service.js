const db = require('../../config/database');
const { getBotSocket } = require('../../bot/botSocket');
const { generateStudentToken } = require('../../middleware/studentAuth');
const { ValidationError } = require('../../utils/errors');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone) {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
}

async function sendCode(phoneNumber) {
  const phone = normalizePhone(phoneNumber);

  // Rate limit: max 3 codes per phone in last 10 minutes
  const recentCodes = await db('verification_codes')
    .where({ phone_number: phone })
    .where('created_at', '>', new Date(Date.now() - 10 * 60 * 1000))
    .count('id as count')
    .first();

  if (parseInt(recentCodes.count, 10) >= 3) {
    throw new ValidationError('Too many attempts. Please wait 10 minutes.');
  }

  const code = generateCode();
  const expires_at = new Date(Date.now() + 5 * 60 * 1000);

  await db('verification_codes').insert({ phone_number: phone, code, expires_at });

  // Send via WhatsApp
  const sock = getBotSocket();
  if (!sock) {
    throw new ValidationError('WhatsApp bot is not connected. Try again shortly.');
  }

  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, {
    text: `Your IroyinMarket verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
  });

  return { sent: true };
}

async function verifyCode(phoneNumber, code) {
  const phone = normalizePhone(phoneNumber);

  const record = await db('verification_codes')
    .where({ phone_number: phone, code, used: false })
    .where('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .first();

  if (!record) {
    throw new ValidationError('Invalid or expired code.');
  }

  // Mark code as used
  await db('verification_codes').where({ id: record.id }).update({ used: true });

  // Find or create student
  let student = await db('students').where({ phone_number: phone }).first();
  if (!student) {
    [student] = await db('students')
      .insert({ phone_number: phone, name: phone, points_balance: 100 })
      .returning('*');
  }

  const token = generateStudentToken(student.id);
  return { token, student: { id: student.id, name: student.name, points_balance: student.points_balance } };
}

async function login(phoneNumber) {
  const phone = normalizePhone(phoneNumber);

  const student = await db('students').where({ phone_number: phone, is_verified: true }).first();
  if (!student) {
    return { exists: false };
  }

  const token = generateStudentToken(student.id);
  return { token, student: { id: student.id, name: student.name, points_balance: student.points_balance } };
}

module.exports = { sendCode, verifyCode, login, normalizePhone };
