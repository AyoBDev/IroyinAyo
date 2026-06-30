const db = require('../../config/database');
const { getIO } = require('../../socket');

const STAKE_MIN = 10;
const STAKE_MAX = 500;

function err(code, message, userMessage, status = 400) {
  const e = new Error(message);
  e.code = code; e.userMessage = userMessage; e.status = status;
  return e;
}

async function createPool(crewId, creatorId, opts) {
  const { poolType, parentMarketId, title, outcomeA, outcomeB, kickoffAt, stakeAmount, currency = 'POINTS' } = opts;
  if (!['public', 'private'].includes(poolType)) throw err('VALIDATION', 'Bad type', 'Pool type must be public or private.');
  if (currency !== 'POINTS') throw err('CURRENCY_NOT_AVAILABLE', 'Currency disabled', 'Real money is not available yet.');
  if (!stakeAmount || stakeAmount < STAKE_MIN || stakeAmount > STAKE_MAX) {
    throw err('STAKE_INVALID', 'Stake out of range', `Stake must be between ${STAKE_MIN} and ${STAKE_MAX} points.`);
  }
  const kickoff = new Date(kickoffAt);
  if (isNaN(kickoff.getTime()) || kickoff.getTime() <= Date.now()) {
    throw err('KICKOFF_PAST', 'Kickoff in past', 'Pick a kickoff time in the future.');
  }
  const member = await db('crew_members').where({ crew_id: crewId, student_id: creatorId }).first();
  if (!member) throw err('NOT_CREW_MEMBER', 'Not a member', 'You\'re not a member of this crew.', 403);

  if (poolType === 'public') {
    if (!parentMarketId) throw err('VALIDATION', 'Missing market', 'Select a market to predict on.');
    // parent_market_id references multi_markets.id (see migration 042).
    // Public pools wrap an open Markets-feed row; auto-resolution fires when
    // the underlying multi_market resolves.
    const market = await db('multi_markets').where({ id: parentMarketId }).first();
    if (!market) throw err('MARKET_NOT_FOUND', 'Market gone', 'We couldn\'t find this market. Pick another.');
    if (market.status !== 'open') {
      throw err('MARKET_NOT_OPEN', 'Market closed', 'This market is no longer accepting predictions.');
    }
  } else {
    if (!title || !outcomeA || !outcomeB) throw err('VALIDATION', 'Missing fields', 'Add a question and two options.');
  }

  const [pool] = await db('crew_pools').insert({
    crew_id: crewId,
    creator_id: creatorId,
    pool_type: poolType,
    parent_market_id: poolType === 'public' ? parentMarketId : null,
    title: poolType === 'private' ? title : null,
    outcome_a_label: poolType === 'private' ? outcomeA : null,
    outcome_b_label: poolType === 'private' ? outcomeB : null,
    kickoff_at: kickoff,
    stake_amount: stakeAmount,
    currency,
    status: 'open',
  }).returning('*');
  return pool;
}

async function predictInPool(poolId, actor, outcome) {
  const { studentId, pendingAccountId } = actor;
  if (!studentId && !pendingAccountId) throw err('VALIDATION', 'No actor', 'Sign in to predict.');
  if (!outcome || typeof outcome !== 'string') throw err('VALIDATION', 'Bad outcome', 'Pick an option to predict.');

  const result = await db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    if (pool.status !== 'open') throw err('POOL_CLOSED', 'Pool not open', 'Pool closed at kickoff. Predict on the next one.', 409);
    if (new Date(pool.kickoff_at).getTime() <= Date.now()) throw err('POOL_CLOSED', 'Past kickoff', 'Pool closed at kickoff.', 409);

    // Validate outcome label
    if (pool.pool_type === 'private') {
      if (![pool.outcome_a_label, pool.outcome_b_label].includes(outcome)) {
        throw err('VALIDATION', 'Outcome mismatch', 'Pick one of the listed options.');
      }
    } else {
      // Public pools accept any label from the wrapped multi_market's
      // outcomes. Auto-resolution looks up the winning outcome's label from
      // multi_market_outcomes and passes it through, so we just need to
      // validate the submitted value matches an outcome on this market.
      const outcomes = await trx('multi_market_outcomes')
        .where({ market_id: pool.parent_market_id })
        .select('label');
      const allowed = outcomes.map((o) => o.label);
      if (!allowed.includes(outcome)) {
        throw err('VALIDATION', 'Outcome mismatch', 'Pick one of the listed options.');
      }
    }

    if (studentId) {
      const member = await trx('crew_members').where({ crew_id: pool.crew_id, student_id: studentId }).first();
      if (!member) throw err('NOT_CREW_MEMBER', 'Not a member', 'You\'re not a member of this crew.', 403);
      const existing = await trx('crew_pool_predictions').where({ pool_id: poolId, student_id: studentId }).first();
      if (existing) throw err('ALREADY_PREDICTED', 'Already predicted', 'You\'ve already predicted on this pool.', 409);
      const student = await trx('students').where({ id: studentId }).forUpdate().first();
      if (student.points_balance < pool.stake_amount) {
        throw err('INSUFFICIENT_POINTS', 'Low balance', `You don\'t have enough points. You have ${student.points_balance}.`, 402);
      }
      await trx('students').where({ id: studentId }).decrement('points_balance', pool.stake_amount);
      const [prediction] = await trx('crew_pool_predictions').insert({
        pool_id: poolId, student_id: studentId, predicted_outcome: outcome, points_locked: pool.stake_amount,
      }).returning('*');
      return { prediction, crewId: pool.crew_id };
    } else {
      const existing = await trx('crew_pool_predictions').where({ pool_id: poolId, pending_account_id: pendingAccountId }).first();
      if (existing) throw err('ALREADY_PREDICTED', 'Already predicted', 'You\'ve already predicted.', 409);
      const [prediction] = await trx('crew_pool_predictions').insert({
        pool_id: poolId, pending_account_id: pendingAccountId, predicted_outcome: outcome, points_locked: pool.stake_amount,
      }).returning('*');
      return { prediction, crewId: pool.crew_id };
    }
  });

  // Emit socket event after transaction commits
  const io = getIO();
  if (io) {
    io.to(`crew:${result.crewId}`).emit('crew:pool:prediction', { poolId, predictionId: result.prediction.id });
  }

  return { prediction: result.prediction };
}

async function closeExpiredPools() {
  const result = await db('crew_pools')
    .where('status', 'open')
    .where('kickoff_at', '<=', db.fn.now())
    .update({ status: 'closed' });
  return { closed: result };
}

async function listPoolsForCrew(crewId) {
  return db('crew_pools')
    .where({ crew_id: crewId })
    .orderBy('kickoff_at', 'desc');
}

async function getPoolDetail(poolId, studentId) {
  const pool = await db('crew_pools').where({ id: poolId }).first();
  if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
  const member = await db('crew_members').where({ crew_id: pool.crew_id, student_id: studentId }).first();
  if (!member) throw err('NOT_CREW_MEMBER', 'Not a member', 'You\'re not a member of this crew.', 403);
  const predictions = await db('crew_pool_predictions')
    .leftJoin('students', 'students.id', 'crew_pool_predictions.student_id')
    .where({ pool_id: poolId })
    .select('crew_pool_predictions.id', 'crew_pool_predictions.student_id', 'crew_pool_predictions.predicted_outcome', 'crew_pool_predictions.payout', 'students.name');
  const currentUserPrediction = predictions.find((p) => p.student_id === studentId) || null;
  // Hide other members' picks until pool is closed or resolved
  const visiblePredictions = pool.status === 'open'
    ? predictions.map((p) => ({ id: p.id, student_id: p.student_id, name: p.name, hasPredicted: true, predicted_outcome: p.student_id === studentId ? p.predicted_outcome : null }))
    : predictions;
  const result = { pool, predictions: visiblePredictions, currentUserPrediction };
  // For public pools, include the wrapped market's outcome labels so the UI can
  // render outcome-specific predict buttons (Arsenal / Draw / Chelsea, etc.)
  // instead of the hard-coded home/away/draw triplet.
  if (pool.pool_type === 'public' && pool.parent_market_id) {
    const outcomes = await db('multi_market_outcomes')
      .where({ market_id: pool.parent_market_id })
      .orderBy('created_at', 'asc')
      .select('id', 'label');
    result.marketOutcomes = outcomes;
    // Surface the parent market's title so the page can show what the pool is on
    const market = await db('multi_markets').where({ id: pool.parent_market_id }).first();
    if (market) result.parentMarket = { id: market.id, title: market.title, status: market.status };
  }
  return result;
}

module.exports = { STAKE_MIN, STAKE_MAX, createPool, predictInPool, closeExpiredPools, listPoolsForCrew, getPoolDetail };
