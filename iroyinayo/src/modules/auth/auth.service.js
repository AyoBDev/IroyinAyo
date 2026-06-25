const bcrypt = require('bcrypt');
const db = require('../../config/database');
const { ValidationError } = require('../../utils/errors');
const posthog = require('../../utils/posthog');
const { normalizePhone, isValidNigerianNumber } = require('./phone');

const PIN_REGEX = /^\d{6}$/;

function generateReferralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function bootstrapStudent({ authUserId, email, name, phoneNumber, pin, referralCode }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('name is required');
  }
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new ValidationError('phoneNumber is required');
  }
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!isValidNigerianNumber(normalizedPhone)) {
    throw new ValidationError('Please enter a valid Nigerian phone number');
  }
  if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
    throw new ValidationError('pin must be 6 digits');
  }

  const existing = await db('students').where({ auth_user_id: authUserId }).first();
  if (existing) {
    return { student: existing, isNew: false };
  }

  let referrer = null;
  if (referralCode && referralCode.trim()) {
    referrer = await db('students')
      .where({ referral_code: referralCode.trim().toUpperCase() })
      .first();
    if (!referrer) {
      throw new ValidationError('Invalid referral code');
    }
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const insertData = {
    auth_user_id: authUserId,
    email,
    name: name.trim(),
    phone_number: normalizedPhone,
    pin_hash: pinHash,
    pin_failed_attempts: 0,
    points_balance: 100,
    is_banned: false,
    campus: 'unilorin',
    referral_code: generateReferralCode(),
    referred_by: referrer ? referrer.id : null,
  };

  let student;
  try {
    [student] = await db('students').insert(insertData).returning('*');
  } catch (err) {
    if (err && err.code === '23505') {
      const detail = String(err.detail || '');
      // Same-auth_user_id race: re-fetch and return idempotently.
      const existing = await db('students').where({ auth_user_id: authUserId }).first();
      if (existing) return { student: existing, isNew: false };
      // Phone collision: another student already has this phone.
      if (detail.includes('phone_number')) {
        throw new ValidationError('That phone number is already registered. Try a different one or sign in.');
      }
      // Email collision: another student already has this email (should be impossible since auth_user_id is unique per Supabase user, but defensively handle).
      if (detail.includes('email')) {
        throw new ValidationError('That email is already registered to a different account.');
      }
      // Unknown unique violation — fall through to re-throw.
      throw err;
    }
    throw err;
  }

  if (referrer) {
    const { applyReferral } = require('../referrals/referrals.service');
    applyReferral(student.id, referralCode.trim().toUpperCase()).catch(() => {});
  }

  posthog.identify({
    distinctId: String(student.id),
    properties: {
      $set: { name: student.name, campus: student.campus, email: student.email },
      $set_once: { first_seen: student.created_at },
    },
  });

  posthog.capture({
    distinctId: String(student.id),
    event: 'user_signed_up',
    properties: { name: student.name, campus: student.campus, had_referral: !!referrer },
  });

  return { student, isNew: true };
}

module.exports = { bootstrapStudent };
