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

async function sendWhatsAppOTP(phone, message) {
  const jid = `${phone}@s.whatsapp.net`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const sock = getBotSocket();
    if (!sock) {
      console.error(`[OTP] No bot socket available (attempt ${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return false;
    }

    try {
      await sock.sendMessage(jid, { text: message });
      console.log(`[OTP] Delivered to ${phone} (attempt ${attempt})`);
      return true;
    } catch (err) {
      console.error(`[OTP] Send failed for ${phone} (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  return false;
}

async function sendCode(phoneNumber) {
  const phone = normalizePhone(phoneNumber);

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

  const delivered = await sendWhatsAppOTP(
    phone,
    `Your IroyinMarket verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`
  );

  if (!delivered) {
    throw new ValidationError('Could not deliver code via WhatsApp. Make sure your number is on WhatsApp and try again.');
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

  const delivered = await sendWhatsAppOTP(
    phone,
    `Your IroyinMarket login code is: *${code}*\n\nThis code expires in 5 minutes.`
  );

  if (!delivered) {
    throw new ValidationError('Could not deliver code via WhatsApp. Make sure your number is on WhatsApp and try again.');
  }

  return { codeSent: true, returning: true };
}

module.exports = { sendCode, verifyCode, login, normalizePhone };
