const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

const PROFIT_FEE_RATE = 0.10;
const MAX_BET_PER_MARKET = 500;
const DEFAULT_LIQUIDITY = 100;

// --- AMM (Constant Product Market Maker) with $1 rule ---
//
// Invariant: yes_pool * no_pool = k (constant)
//
// Pricing ($1 rule):
//   Price of YES share = no_pool / (yes_pool + no_pool)
//   Price of NO share  = yes_pool / (yes_pool + no_pool)
//   YES price + NO price = 1  (always)
//
// Buying shares:
//   Spend `amount` points → receive `shares` of chosen side.
//   shares = amount / average_execution_price
//
//   Using CPMM math:
//   Buy YES: add `amount` to yes_pool, shares = no_pool - k/(yes_pool + amount)
//   The effective avg price = amount / shares
//
// Resolution ($1 rule):
//   Each winning share pays out exactly 1 point.
//   Each losing share pays out 0 points.
//   Example: buy 100 YES shares at 0.30 → spend 30 pts.
//            YES wins → receive 100 pts. Profit = 70 pts.
//            NO wins  → receive 0 pts. Loss = 30 pts.

// LMSR (Logarithmic Market Scoring Rule) — Hanson's market maker
// Used by Polymarket. The liquidity parameter `b` controls price sensitivity.
//
// The market tracks outstanding shares: yes_pool = YES shares sold, no_pool = NO shares sold.
// Cost function: C(q_yes, q_no) = b * ln(e^(q_yes/b) + e^(q_no/b))
// Price of YES = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
// YES price + NO price = 1 always ($1 rule)
//
// To buy `n` YES shares:
//   cost = C(q_yes + n, q_no) - C(q_yes, q_no)
// Inversely, given `amount` to spend:
//   solve for n where cost(n) = amount

function calculatePrice(yesPool, noPool, side) {
  // yesPool/noPool here represent outstanding shares sold on each side
  // We use the market's liquidity parameter (b) implicitly via the pool values
  // For display: price = e^(q/b) / (e^(q_yes/b) + e^(q_no/b))
  // Simplified when we store normalized values: price = pool / (yesPool + noPool)
  const totalPool = yesPool + noPool;
  if (totalPool === 0) return 0.5;
  if (side === 'yes') return yesPool / totalPool;
  return noPool / totalPool;
}

function calculateSharesOut(yesPool, noPool, side, amount) {
  // $1 rule: shares = amount / avg_execution_price
  // avg_execution_price is between current_price and new_price after the trade
  //
  // Using the constant-sum invariant approach:
  //   Buying YES shares: the buyer pays `amount`, receives shares worth 1 pt each if YES wins
  //   The price they pay per share = amount / shares
  //   This must be between current YES price and the new (higher) YES price
  //
  // Formula derived from LMSR cost function with b = totalPool/2:
  //   For buying YES: shares = totalPool * ln(1 + amount/noPool) / ln(totalPool/(totalPool-amount+amount))
  //   Simplified using pool ratios:

  const totalPool = yesPool + noPool;
  const b = totalPool / 2; // liquidity depth

  if (side === 'yes') {
    // Cost to buy n YES shares: b * ln((e^((yesPool+n)/b) + e^(noPool/b)) / (e^(yesPool/b) + e^(noPool/b)))
    // Binary search for n where cost = amount
    let lo = 0, hi = totalPool * 2;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const cost = lmsrCost(yesPool, noPool, b, 'yes', mid);
      if (cost < amount) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  } else {
    let lo = 0, hi = totalPool * 2;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const cost = lmsrCost(yesPool, noPool, b, 'no', mid);
      if (cost < amount) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
}

function lmsrCost(yesPool, noPool, b, side, n) {
  // Cost of buying n shares of `side`
  // C = b * ln(e^(q_yes/b) + e^(q_no/b))
  // cost = C(after) - C(before)
  const before = b * logSumExp(yesPool / b, noPool / b);
  let after;
  if (side === 'yes') {
    after = b * logSumExp((yesPool + n) / b, noPool / b);
  } else {
    after = b * logSumExp(yesPool / b, (noPool + n) / b);
  }
  return after - before;
}

function logSumExp(a, c) {
  // Numerically stable: ln(e^a + e^c)
  const max = Math.max(a, c);
  return max + Math.log(Math.exp(a - max) + Math.exp(c - max));
}

function newPoolsAfterBuy(yesPool, noPool, side, shares) {
  // After buying shares, update the outstanding shares count
  if (side === 'yes') {
    return { yes_pool: yesPool + shares, no_pool: noPool };
  }
  return { yes_pool: yesPool, no_pool: noPool + shares };
}

function withPrices(market) {
  return {
    ...market,
    yes_price: calculatePrice(market.yes_pool, market.no_pool, 'yes'),
    no_price: calculatePrice(market.yes_pool, market.no_pool, 'no'),
  };
}

async function create({ question, description, category, closes_at, created_by_type, created_by_id, sponsor_bonus }) {
  const isApproved = created_by_type === 'admin';
  const liquidity = DEFAULT_LIQUIDITY;
  const [market] = await db('markets')
    .insert({
      question, description, category, closes_at,
      created_by_type, created_by_id,
      is_approved: isApproved,
      sponsor_bonus: sponsor_bonus || 0,
      yes_pool: liquidity,
      no_pool: liquidity,
      liquidity,
    })
    .returning('*');
  return withPrices(market);
}

async function getById(id) {
  const market = await db('markets').where({ id }).first();
  if (!market) throw new NotFoundError('Market not found');
  return withPrices(market);
}

async function listOpen() {
  const markets = await db('markets')
    .where({ status: 'open', is_approved: true })
    .where('closes_at', '>', new Date())
    .orderBy('closes_at', 'asc');
  return markets.map(withPrices);
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
  if (amount < 1) throw new ValidationError('Amount must be at least 1');

  const existingTotal = await db('market_positions')
    .where({ market_id: marketId, student_id: studentId })
    .sum('amount as total').first();
  const currentTotal = Number(existingTotal?.total || 0);
  if (currentTotal + amount > MAX_BET_PER_MARKET) {
    throw new ValidationError(`Max bet per market is ${MAX_BET_PER_MARKET} points. You have ${currentTotal} already placed.`);
  }

  const shares = calculateSharesOut(market.yes_pool, market.no_pool, side, amount);
  if (shares <= 0) throw new ValidationError('Trade too small or pool exhausted');

  await gamificationService.deductPoints(studentId, amount, 'market_buy', `Bought ${side} on: ${market.question}`, marketId);

  // LMSR: buying shares increases the outstanding share count for that side
  const pools = newPoolsAfterBuy(market.yes_pool, market.no_pool, side, shares);
  await db('markets').where({ id: marketId }).update({
    yes_pool: pools.yes_pool,
    no_pool: pools.no_pool,
  });

  const [position] = await db('market_positions')
    .insert({ market_id: marketId, student_id: studentId, side, amount, shares })
    .returning('*');

  return { position, market: await getById(marketId) };
}

async function resolve(marketId, outcome) {
  if (!['yes', 'no'].includes(outcome)) throw new ValidationError('Outcome must be yes or no');

  const market = await db('markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status === 'resolved') throw new ValidationError('Market already resolved');

  // $1 rule: each winning share pays exactly 1 point
  // Sponsor bonus is distributed proportionally to winners
  const winningPositions = await db('market_positions').where({ market_id: marketId, side: outcome });
  const totalWinningShares = winningPositions.reduce((sum, p) => sum + p.shares, 0);
  const sponsorBonus = market.sponsor_bonus || 0;

  for (const position of winningPositions) {
    // $1 rule: 1 point per share
    let payout = Math.floor(position.shares);
    // Add proportional sponsor bonus
    if (sponsorBonus > 0 && totalWinningShares > 0) {
      payout += Math.floor((position.shares / totalWinningShares) * sponsorBonus);
    }

    // 10% fee on profit only (payout - original spend)
    const profit = payout - position.amount;
    if (profit > 0) {
      const fee = Math.floor(profit * PROFIT_FEE_RATE);
      payout -= fee;
    }

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

  return { markets: markets.map(withPrices), total, page, limit };
}

module.exports = { create, getById, listOpen, listPendingApproval, approve, buyPosition, resolve, sponsorMarket, getStudentPositions, calculatePrice, listAll };
