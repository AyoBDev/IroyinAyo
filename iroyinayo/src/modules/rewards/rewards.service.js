const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

const MINIMUM_REDEMPTION_POINTS = 500;

async function createRewardOption({ name, type, points_cost, value }) {
  const [option] = await db('reward_options').insert({ name, type, points_cost, value }).returning('*');
  return option;
}

async function listActiveOptions() {
  return db('reward_options').where({ is_active: true }).orderBy('points_cost', 'asc');
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

  await gamificationService.deductPoints(studentId, option.points_cost, 'redeem', `Redeemed: ${option.name}`, rewardOptionId);

  const [redemption] = await db('redemptions')
    .insert({ student_id: studentId, reward_option_id: rewardOptionId, phone_number: student.phone_number })
    .returning('*');

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

module.exports = { createRewardOption, listActiveOptions, redeem, fulfillRedemption, getStudentRedemptions, listPendingRedemptions, MINIMUM_REDEMPTION_POINTS };
