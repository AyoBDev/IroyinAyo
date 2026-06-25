const db = require('../../config/database');
const { ValidationError } = require('../../utils/errors');
const posthog = require('../../utils/posthog');

function generateReferralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function bootstrapStudent({ authUserId, email, name, referralCode }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('name is required');
  }

  const existing = await db('students').where({ auth_user_id: authUserId }).first();
  if (existing) {
    return { student: existing, isNew: false };
  }

  // Validate referral code (if provided) before inserting.
  let referrer = null;
  if (referralCode && referralCode.trim()) {
    referrer = await db('students')
      .where({ referral_code: referralCode.trim().toUpperCase() })
      .first();
    if (!referrer) {
      throw new ValidationError('Invalid referral code');
    }
  }

  const insertData = {
    auth_user_id: authUserId,
    email,
    name: name.trim(),
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
    // Handle race condition: concurrent bootstraps on same auth_user_id
    if (err && err.code === '23505') {
      student = await db('students').where({ auth_user_id: authUserId }).first();
      if (!student) throw err; // unique violation but no row — re-throw
      return { student, isNew: false };
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
