const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

/**
 * Numerically stable computation of ln(sum(e^vi))
 * Uses the max trick to prevent overflow
 */
function logSumExp(values) {
  const maxVal = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + Math.exp(v - maxVal), 0);
  return maxVal + Math.log(sum);
}

/**
 * Calculate prices for all outcomes using LMSR softmax formula
 * @param {number[]} sharesSold - array of shares sold per outcome
 * @param {number} b - liquidity parameter
 * @returns {number[]} - array of prices (probabilities) that sum to 1
 */
function calculatePrices(sharesSold, b) {
  const scaledShares = sharesSold.map((q) => q / b);
  const lse = logSumExp(scaledShares);
  return scaledShares.map((q) => Math.exp(q - lse));
}

/**
 * Calculate cost to buy n shares of a specific outcome
 * Uses LMSR cost function: C(q) = b * ln(sum(e^(qi/b)))
 * @param {number[]} sharesSold - current shares sold per outcome
 * @param {number} b - liquidity parameter
 * @param {number} outcomeIndex - index of outcome to buy
 * @param {number} n - number of shares to buy
 * @returns {number} - cost in points
 */
function calculateCost(sharesSold, b, outcomeIndex, n) {
  const scaledBefore = sharesSold.map((q) => q / b);
  const scaledAfter = sharesSold.map((q, i) => (i === outcomeIndex ? q + n : q) / b);

  const costBefore = b * logSumExp(scaledBefore);
  const costAfter = b * logSumExp(scaledAfter);

  return costAfter - costBefore;
}

/**
 * Binary search to find number of shares that cost exactly the given amount
 * @param {number[]} sharesSold - current shares sold per outcome
 * @param {number} b - liquidity parameter
 * @param {number} outcomeIndex - index of outcome to buy
 * @param {number} amount - target amount to spend
 * @returns {number} - number of shares that cost approximately the amount
 */
function calculateSharesForAmount(sharesSold, b, outcomeIndex, amount) {
  let lo = 0;
  let hi = b * 10;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateCost(sharesSold, b, outcomeIndex, mid);

    if (Math.abs(cost - amount) < 0.01) {
      return mid;
    }

    if (cost < amount) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

/**
 * Create a new multi-outcome market
 * @param {string} title - market question/title
 * @param {number} liquidityB - LMSR liquidity parameter (default 100)
 * @returns {object} - created market row
 */
async function createMarket(title, liquidityB = 25) {
  const [market] = await db('multi_markets')
    .insert({
      title,
      liquidity_b: liquidityB,
      status: 'open',
    })
    .returning('*');
  return market;
}

/**
 * Add an outcome to a market
 * @param {string} marketId - market UUID
 * @param {string} label - outcome label
 * @returns {object} - created outcome row
 */
async function addOutcome(marketId, label) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) {
    throw new NotFoundError('Market not found');
  }
  if (market.status !== 'open') {
    throw new ValidationError('Market is not open');
  }

  const [outcome] = await db('multi_market_outcomes')
    .insert({
      market_id: marketId,
      label,
      shares_sold: 0,
    })
    .returning('*');
  return outcome;
}

/**
 * Remove an outcome from a market (only if no positions exist)
 * @param {string} marketId - market UUID
 * @param {string} outcomeId - outcome UUID
 */
async function removeOutcome(marketId, outcomeId) {
  const positions = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: outcomeId })
    .count('* as count')
    .first();

  if (parseInt(positions.count, 10) > 0) {
    throw new ValidationError('Cannot remove outcome with existing positions');
  }

  await db('multi_market_outcomes').where({ id: outcomeId }).del();
}

/**
 * Get market with all outcomes and computed prices
 * @param {string} marketId - market UUID
 * @returns {object} - market with outcomes array (each with price)
 */
async function getMarketWithOdds(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) {
    throw new NotFoundError('Market not found');
  }

  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  const sharesSold = outcomes.map((o) => o.shares_sold);
  const prices = calculatePrices(sharesSold, market.liquidity_b);

  const outcomesWithPrices = outcomes.map((outcome, index) => ({
    ...outcome,
    price: prices[index],
  }));

  return {
    ...market,
    outcomes: outcomesWithPrices,
  };
}

/**
 * List all open markets with outcomes and prices
 * @returns {object[]} - array of markets with outcomes
 */
async function listOpenMarkets() {
  const markets = await db('multi_markets').where({ status: 'open' }).orderBy('created_at', 'desc');

  const marketsWithOdds = await Promise.all(
    markets.map((market) => getMarketWithOdds(market.id))
  );

  return marketsWithOdds;
}

/**
 * Buy a position in a market outcome
 * @param {string} marketId - market UUID
 * @param {string} outcomeId - outcome UUID
 * @param {string} studentId - student UUID
 * @param {number} amount - points to spend
 * @returns {object} - {position, market}
 */
async function buyPosition(marketId, outcomeId, studentId, amount) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) {
    throw new NotFoundError('Market not found');
  }
  if (market.status !== 'open') {
    throw new ValidationError('Market is not open');
  }

  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  const outcomeIndex = outcomes.findIndex((o) => o.id === outcomeId);
  if (outcomeIndex === -1) {
    throw new NotFoundError('Outcome not found in this market');
  }

  const sharesSold = outcomes.map((o) => o.shares_sold);

  const shares = calculateSharesForAmount(sharesSold, market.liquidity_b, outcomeIndex, amount);

  return db.transaction(async (trx) => {
    await gamificationService.deductPoints(
      studentId,
      amount,
      'multi_market',
      `Bought ${shares.toFixed(2)} shares in: ${market.title}`,
      marketId
    );

    await trx('multi_market_outcomes')
      .where({ id: outcomeId })
      .increment('shares_sold', shares);

    const [position] = await trx('multi_market_positions')
      .insert({
        market_id: marketId,
        outcome_id: outcomeId,
        student_id: studentId,
        amount,
        shares,
        payout: 0,
      })
      .returning('*');

    return { position, market };
  });
}

/**
 * Resolve a market and pay winners
 * @param {string} marketId - market UUID
 * @param {string} winningOutcomeId - winning outcome UUID
 * @returns {object} - resolved market
 */
async function resolveMarket(marketId, winningOutcomeId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) {
    throw new NotFoundError('Market not found');
  }
  if (market.status === 'resolved') {
    throw new ValidationError('Market already resolved');
  }

  return db.transaction(async (trx) => {
    const winningPositions = await trx('multi_market_positions')
      .where({ market_id: marketId, outcome_id: winningOutcomeId });

    for (const position of winningPositions) {
      const payout = Math.floor(position.shares);

      await trx('multi_market_positions')
        .where({ id: position.id })
        .update({ payout });

      if (payout > 0) {
        await gamificationService.addPoints(
          position.student_id,
          payout,
          'multi_market_win',
          `Won ${payout} points from market: ${market.title}`,
          marketId
        );
      }
    }

    const [resolvedMarket] = await trx('multi_markets')
      .where({ id: marketId })
      .update({
        status: 'resolved',
        winning_outcome_id: winningOutcomeId,
        resolved_at: trx.fn.now(),
      })
      .returning('*');

    return resolvedMarket;
  });
}

/**
 * Get all positions for a student
 * @param {string} studentId - student UUID
 * @returns {object[]} - array of positions with market and outcome info
 */
async function getStudentPositions(studentId) {
  return db('multi_market_positions')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
    .where({ 'multi_market_positions.student_id': studentId })
    .select(
      'multi_market_positions.*',
      'multi_markets.title as market_title',
      'multi_markets.status as market_status',
      'multi_market_outcomes.label as outcome_label'
    )
    .orderBy('multi_market_positions.created_at', 'desc');
}

module.exports = {
  logSumExp,
  calculatePrices,
  calculateCost,
  calculateSharesForAmount,
  createMarket,
  addOutcome,
  removeOutcome,
  getMarketWithOdds,
  listOpenMarkets,
  buyPosition,
  resolveMarket,
  getStudentPositions,
};
