const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

const SYSTEM_FEE_RATE = 0.10;
const MAX_BET_PER_MARKET = 500;

function calculatePrice(yesPool, noPool, side) {
  const totalPool = yesPool + noPool;
  if (totalPool === 0) return 0.5;
  if (side === 'yes') return yesPool / totalPool;
  return noPool / totalPool;
}

async function create({ question, description, category, closes_at, created_by_type, created_by_id, sponsor_bonus }) {
  const isApproved = created_by_type === 'admin';
  const [market] = await db('markets')
    .insert({ question, description, category, closes_at, created_by_type, created_by_id, is_approved: isApproved, sponsor_bonus: sponsor_bonus || 0 })
    .returning('*');
  return market;
}

async function getById(id) {
  const market = await db('markets').where({ id }).first();
  if (!market) throw new NotFoundError('Market not found');
  return {
    ...market,
    yes_price: calculatePrice(market.yes_pool, market.no_pool, 'yes'),
    no_price: calculatePrice(market.yes_pool, market.no_pool, 'no'),
  };
}

async function listOpen() {
  const markets = await db('markets')
    .where({ status: 'open', is_approved: true })
    .where('closes_at', '>', new Date())
    .orderBy('closes_at', 'asc');
  return markets.map((m) => ({
    ...m,
    yes_price: calculatePrice(m.yes_pool, m.no_pool, 'yes'),
    no_price: calculatePrice(m.yes_pool, m.no_pool, 'no'),
  }));
}

async function listPendingApproval() {
  return db('markets').where({ is_approved: false }).orderBy('created_at', 'desc');
}

async function approve(id) {
  const market = await db('markets').where({ id }).first();
  if (!market) throw new NotFoundError('Market not found');
  await db('markets').where({ id }).update({ is_approved: true });
  if (market.created_by_type === 'student') {
    await gamificationService.addPoints(market.created_by_id, 10, 'market_proposal', 'Market proposal approved', id);
  }
  return getById(id);
}

async function buyPosition(marketId, studentId, side, amount) {
  const market = await db('markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'open') throw new ValidationError('Market is not open');
  if (!market.is_approved) throw new ValidationError('Market is not approved');
  if (new Date(market.closes_at) <= new Date()) throw new ValidationError('Market has closed');

  const existingTotal = await db('market_positions')
    .where({ market_id: marketId, student_id: studentId })
    .sum('amount as total').first();
  const currentTotal = Number(existingTotal?.total || 0);
  if (currentTotal + amount > MAX_BET_PER_MARKET) {
    throw new ValidationError(`Max bet per market is ${MAX_BET_PER_MARKET} points. You have ${currentTotal} already placed.`);
  }

  await gamificationService.deductPoints(studentId, amount, 'market_buy', `Bought ${side} on: ${market.question}`, marketId);

  const poolColumn = side === 'yes' ? 'yes_pool' : 'no_pool';
  await db('markets').where({ id: marketId }).increment(poolColumn, amount);

  const [position] = await db('market_positions')
    .insert({ market_id: marketId, student_id: studentId, side, amount })
    .returning('*');

  return { position, market: await getById(marketId) };
}

async function resolve(marketId, outcome) {
  if (!['yes', 'no'].includes(outcome)) throw new ValidationError('Outcome must be yes or no');

  const market = await db('markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status === 'resolved') throw new ValidationError('Market already resolved');

  const totalPool = market.yes_pool + market.no_pool + market.sponsor_bonus;
  const systemFee = Math.floor(totalPool * SYSTEM_FEE_RATE);
  const payoutPool = totalPool - systemFee;

  const winningPositions = await db('market_positions').where({ market_id: marketId, side: outcome });
  const totalWinningAmount = winningPositions.reduce((sum, p) => sum + p.amount, 0);

  for (const position of winningPositions) {
    let payout = totalWinningAmount > 0 ? Math.floor((position.amount / totalWinningAmount) * payoutPool) : 0;
    if (payout > 0) {
      await gamificationService.addPoints(position.student_id, payout, 'market_win', `Won prediction: ${market.question}`, marketId);
      await db('market_positions').where({ id: position.id }).update({ payout });
    }
  }

  await db('markets').where({ id: marketId }).update({ status: 'resolved', outcome, resolved_at: new Date() });
  return getById(marketId);
}

async function sponsorMarket(marketId, bonusAmount) {
  const market = await db('markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  await db('markets').where({ id: marketId }).increment('sponsor_bonus', bonusAmount);
  return getById(marketId);
}

async function getStudentPositions(studentId) {
  return db('market_positions')
    .join('markets', 'market_positions.market_id', 'markets.id')
    .where({ 'market_positions.student_id': studentId })
    .select('market_positions.*', 'markets.question', 'markets.status as market_status', 'markets.outcome as market_outcome')
    .orderBy('market_positions.created_at', 'desc');
}

async function listAll({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const markets = await db('markets')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const countResult = await db('markets').count('id as count').first();
  const total = parseInt(countResult.count, 10);

  const withPrices = markets.map((m) => ({
    ...m,
    yes_price: calculatePrice(m.yes_pool, m.no_pool, 'yes'),
    no_price: calculatePrice(m.yes_pool, m.no_pool, 'no'),
  }));

  return { markets: withPrices, total, page, limit };
}

module.exports = { create, getById, listOpen, listPendingApproval, approve, buyPosition, resolve, sponsorMarket, getStudentPositions, calculatePrice, listAll };
