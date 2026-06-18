const db = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

const REFERRER_BONUS = 50;
const REFERRED_BONUS = 50;
const MAX_REFERRALS_PER_DAY = 10;

function generateReferralCode(name) {
  const prefix = (name || 'user').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

async function getOrCreateCode(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');

  if (student.referral_code) return student.referral_code;

  let code = generateReferralCode(student.name);
  let attempts = 0;
  while (attempts < 5) {
    const exists = await db('students').where({ referral_code: code }).first();
    if (!exists) break;
    code = generateReferralCode(student.name);
    attempts++;
  }

  await db('students').where({ id: studentId }).update({ referral_code: code });
  return code;
}

async function applyReferral(referredStudentId, referralCode) {
  const referrer = await db('students').where({ referral_code: referralCode }).first();
  if (!referrer) throw new ValidationError('Invalid referral code');
  if (referrer.id === referredStudentId) throw new ValidationError('Cannot refer yourself');

  const existing = await db('referrals').where({ referred_id: referredStudentId }).first();
  if (existing) throw new ValidationError('Referral already applied');

  const todayReferrals = await db('referrals')
    .where({ referrer_id: referrer.id })
    .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
    .count('id as count')
    .first();

  if (parseInt(todayReferrals.count, 10) >= MAX_REFERRALS_PER_DAY) {
    throw new ValidationError('Referrer has reached daily limit');
  }

  await db.transaction(async (trx) => {
    await trx('referrals').insert({
      referrer_id: referrer.id,
      referred_id: referredStudentId,
      referrer_bonus: REFERRER_BONUS,
      referred_bonus: REFERRED_BONUS,
    });

    await trx('students').where({ id: referredStudentId }).update({ referred_by: referrer.id });
  });

  await gamificationService.addPoints(referrer.id, REFERRER_BONUS, 'referral', 'Referral bonus: new user joined');
  await gamificationService.addPoints(referredStudentId, REFERRED_BONUS, 'referral', `Welcome bonus: referred by ${referrer.name}`);

  // Auto-promote to ambassador at 10 referrals
  const totalReferrals = await db('referrals')
    .where({ referrer_id: referrer.id })
    .count('id as count')
    .first();
  if (parseInt(totalReferrals.count, 10) >= 10 && !referrer.is_ambassador) {
    await db('students').where({ id: referrer.id }).update({ is_ambassador: true });
  }

  return { referrerBonus: REFERRER_BONUS, referredBonus: REFERRED_BONUS };
}

async function getReferralStats(studentId) {
  const count = await db('referrals')
    .where({ referrer_id: studentId })
    .count('id as count')
    .first();

  const totalEarned = await db('referrals')
    .where({ referrer_id: studentId })
    .sum('referrer_bonus as total')
    .first();

  const code = await getOrCreateCode(studentId);

  return {
    code,
    referralCount: parseInt(count.count, 10),
    totalEarned: parseInt(totalEarned.total, 10) || 0,
  };
}

module.exports = { getOrCreateCode, applyReferral, getReferralStats };
