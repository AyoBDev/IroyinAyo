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
  if (sock) {
    try {
      const jid = `${phone}@s.whatsapp.net`;
      await sock.sendMessage(jid, {
        text: `Your IroyinMarket verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      });
    } catch (err) {
      console.log(`[DEV] WhatsApp send failed. Verification code for ${phone}: ${code}`);
    }
  } else {
    console.log(`[DEV] No WhatsApp bot. Verification code for ${phone}: ${code}`);
  }

  return { sent: true };
}

async function verifyCode(phoneNumber, code, name, referralCode) {
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
    if (!referralCode) {
      throw new ValidationError('Invite code required. Ask a friend who is already on IroyinMarket for their code.');
    }

    const referrer = await db('students').where({ referral_code: referralCode }).first();
    if (!referrer) {
      throw new ValidationError('Invalid invite code. Check with the person who shared it.');
    }

    [student] = await db('students')
      .insert({ phone_number: phone, name, points_balance: 100, is_verified: true, referred_by: referrer.id, campus: 'unilorin' })
      .returning('*');

    const { applyReferral } = require('../referrals/referrals.service');
    applyReferral(student.id, referralCode).catch(() => {});
  } else {
    const updateFields = { is_verified: true };
    if (name && name !== '_returning') updateFields.name = name;
    [student] = await db('students')
      .where({ id: student.id })
      .update(updateFields)
      .returning('*');
  }

  const token = generateStudentToken(student.id);
  return { token, student: { id: student.id, name: student.name, points_balance: student.points_balance } };
}

async function login(phoneNumber) {
  const phone = normalizePhone(phoneNumber);

  const student = await db('students').where({ phone_number: phone, is_verified: true }).first();
  if (!student) {
    // Return same shape to prevent account enumeration
    return { codeSent: true };
  }

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

  const sock = getBotSocket();
  if (sock) {
    try {
      const jid = `${phone}@s.whatsapp.net`;
      await sock.sendMessage(jid, {
        text: `Your IroyinMarket login code is: *${code}*\n\nThis code expires in 5 minutes.`,
      });
    } catch (err) {
      console.log(`[DEV] WhatsApp send failed. Login code for ${phone}: ${code}`);
    }
  } else {
    console.log(`[DEV] No WhatsApp bot. Login code for ${phone}: ${code}`);
  }

  return { codeSent: true, returning: true };
}

module.exports = { sendCode, verifyCode, login, normalizePhone };
