const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');
const posthog = require('../../utils/posthog');

const MINIMUM_REDEMPTION_POINTS = 500;
const WEEKLY_BUDGET_NGN = 10000;
const MAX_REDEMPTIONS_PER_WEEK = 1;
const REDEMPTION_COOLDOWN_DAYS = 7;
const NON_REDEEMABLE_TYPES = ['auto_refill', 'referral', 'signup'];

async function createRewardOption({ name, type, points_cost, value }) {
  const [option] = await db('reward_options').insert({ name, type, points_cost, value }).returning('*');
  return option;
}

async function listActiveOptions() {
  return db('reward_options').where({ is_active: true }).orderBy('points_cost', 'asc');
}

async function getEarnedPoints(studentId) {
  const result = await db('point_transactions')
    .where({ student_id: studentId })
    .whereNotIn('type', NON_REDEEMABLE_TYPES)
    .where('amount', '>', 0)
    .sum('amount as total')
    .first();

  const redeemed = await db('point_transactions')
    .where({ student_id: studentId, type: 'redeem' })
    .sum(db.raw('ABS(amount) as total'))
    .first();

  const earned = parseInt(result.total, 10) || 0;
  const spent = parseInt(redeemed.total, 10) || 0;
  return earned - spent;
}

async function getWeeklyBudgetRemaining() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const weekRedemptions = await db('redemptions')
    .join('reward_options', 'redemptions.reward_option_id', 'reward_options.id')
    .where('redemptions.created_at', '>=', monday)
    .sum('reward_options.value as total_value')
    .first();

  const spent = parseInt(weekRedemptions.total_value, 10) || 0;
  return WEEKLY_BUDGET_NGN - spent;
}

async function redeem(studentId, rewardOptionId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');

  const option = await db('reward_options').where({ id: rewardOptionId, is_active: true }).first();
  if (!option) throw new NotFoundError('Reward option not found or inactive');

  if (student.points_balance < MINIMUM_REDEMPTION_POINTS) {
    throw new ValidationError(`Minimum ${MINIMUM_REDEMPTION_POINTS} points required to redeem`);
  }

  if (student.points_balance < option.points_cost) {
    throw new ValidationError('Insufficient points for this reward');
  }

  const earnedPoints = await getEarnedPoints(studentId);
  if (earnedPoints < option.points_cost) {
    throw new ValidationError(`You need ${option.points_cost} earned points to redeem (you have ${earnedPoints}). Keep predicting to earn more!`);
  }

  const lastRedemption = await db('redemptions')
    .where({ student_id: studentId })
    .orderBy('created_at', 'desc')
    .first();

  if (lastRedemption) {
    const daysSince = (Date.now() - new Date(lastRedemption.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < REDEMPTION_COOLDOWN_DAYS) {
      const daysLeft = Math.ceil(REDEMPTION_COOLDOWN_DAYS - daysSince);
      throw new ValidationError(`You can redeem once per week. Try again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`);
    }
  }

  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const weeklyCount = await db('redemptions')
    .where({ student_id: studentId })
    .where('created_at', '>=', monday)
    .count('id as count')
    .first();

  if (parseInt(weeklyCount.count, 10) >= MAX_REDEMPTIONS_PER_WEEK) {
    throw new ValidationError('Weekly redemption limit reached. Come back next week!');
  }

  const budgetRemaining = await getWeeklyBudgetRemaining();
  if (option.value > budgetRemaining) {
    throw new ValidationError('Weekly reward pool is used up. Try again next Monday!');
  }

  await gamificationService.deductPoints(studentId, option.points_cost, 'redeem', `Redeemed: ${option.name}`, rewardOptionId);

  const [redemption] = await db('redemptions')
    .insert({ student_id: studentId, reward_option_id: rewardOptionId, phone_number: student.phone_number })
    .returning('*');

  posthog.capture({
    distinctId: String(studentId),
    event: 'reward_redeemed',
    properties: {
      reward_option_id: rewardOptionId,
      reward_name: option.name,
      reward_type: option.type,
      reward_value: option.value,
      points_cost: option.points_cost,
    },
  });

  return { redemption, reward: option };
}

async function fulfillRedemption(redemptionId) {
  const redemption = await db('redemptions').where({ id: redemptionId }).first();
  if (!redemption) throw new NotFoundError('Redemption not found');
  await db('redemptions').where({ id: redemptionId }).update({ status: 'fulfilled', fulfilled_at: new Date() });
  return db('redemptions').where({ id: redemptionId }).first();
}

async function getStudentRedemptions(studentId) {
  return db('redemptions')
    .join('reward_options', 'redemptions.reward_option_id', 'reward_options.id')
    .where({ 'redemptions.student_id': studentId })
    .select('redemptions.*', 'reward_options.name as reward_name', 'reward_options.value as reward_value')
    .orderBy('redemptions.created_at', 'desc');
}

async function listPendingRedemptions() {
  return db('redemptions')
    .join('reward_options', 'redemptions.reward_option_id', 'reward_options.id')
    .join('students', 'redemptions.student_id', 'students.id')
    .where({ 'redemptions.status': 'pending' })
    .select('redemptions.*', 'reward_options.name as reward_name', 'reward_options.value as reward_value', 'students.name as student_name', 'students.phone_number')
    .orderBy('redemptions.created_at', 'asc');
}

async function getRewardStatus(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');

  const earnedPoints = await getEarnedPoints(studentId);
  const budgetRemaining = await getWeeklyBudgetRemaining();

  const lastRedemption = await db('redemptions')
    .where({ student_id: studentId })
    .orderBy('created_at', 'desc')
    .first();

  let canRedeem = true;
  let reason = null;

  if (student.points_balance < MINIMUM_REDEMPTION_POINTS) {
    canRedeem = false;
    reason = `Need ${MINIMUM_REDEMPTION_POINTS} points minimum (you have ${student.points_balance})`;
  } else if (earnedPoints < MINIMUM_REDEMPTION_POINTS) {
    canRedeem = false;
    reason = `Need ${MINIMUM_REDEMPTION_POINTS} earned points (you have ${earnedPoints}). Bonus points can't be redeemed.`;
  } else if (budgetRemaining <= 0) {
    canRedeem = false;
    reason = 'Weekly reward pool used up. Try again next Monday!';
  } else if (lastRedemption) {
    const daysSince = (Date.now() - new Date(lastRedemption.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < REDEMPTION_COOLDOWN_DAYS) {
      canRedeem = false;
      reason = `Cooldown: ${Math.ceil(REDEMPTION_COOLDOWN_DAYS - daysSince)} days left`;
    }
  }

  return {
    balance: student.points_balance,
    earnedPoints,
    canRedeem,
    reason,
    weeklyBudgetRemaining: budgetRemaining,
  };
}

async function getRecentPayouts(limit = 10) {
  const payouts = await db('redemptions')
    .join('reward_options', 'redemptions.reward_option_id', 'reward_options.id')
    .join('students', 'redemptions.student_id', 'students.id')
    .where('redemptions.status', 'fulfilled')
    .orderBy('redemptions.fulfilled_at', 'desc')
    .limit(limit)
    .select(
      'students.name',
      'reward_options.name as reward_name',
      'reward_options.value as reward_value',
      'redemptions.fulfilled_at'
    );

  return payouts.map(p => ({
    name: p.name.length > 8 ? p.name.slice(0, 8) + '...' : p.name,
    reward_name: p.reward_name,
    reward_value: p.reward_value,
    fulfilled_at: p.fulfilled_at,
  }));
}

module.exports = {
  createRewardOption, listActiveOptions, redeem, fulfillRedemption,
  getStudentRedemptions, listPendingRedemptions, getRewardStatus, getWeeklyBudgetRemaining,
  getRecentPayouts,
  MINIMUM_REDEMPTION_POINTS, WEEKLY_BUDGET_NGN, MAX_REDEMPTIONS_PER_WEEK,
};
