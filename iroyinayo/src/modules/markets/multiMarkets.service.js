const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');
const { afterMultiTrade } = require('../liquidity/liquidity.hooks');
const posthog = require('../../utils/posthog');

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
 * Calculate optimal liquidity_b based on active user count.
 * More users = higher liquidity needed to prevent wild price swings.
 */
async function getAutoLiquidityB() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await db('students')
    .join('point_transactions', 'students.id', 'point_transactions.student_id')
    .where('point_transactions.created_at', '>', weekAgo)
    .countDistinct('students.id as active_users')
    .first();

  const activeUsers = parseInt(result?.active_users || 0, 10);

  if (activeUsers <= 50) return 25;
  if (activeUsers <= 150) return 50;
  if (activeUsers <= 300) return 75;
  if (activeUsers <= 500) return 100;
  return 150;
}

/**
 * Create a new multi-outcome market
 * @param {string} title - market question/title
 * @param {number} liquidityB - LMSR liquidity parameter (default: auto-scaled)
 * @param {object} [sponsorData] - optional sponsor info
 * @returns {object} - created market row
 */
async function createMarket(title, liquidityB, sponsorData) {
  const b = liquidityB || await getAutoLiquidityB();

  const insert = {
    title,
    liquidity_b: b,
    status: 'open',
  };

  if (sponsorData) {
    insert.is_sponsored = true;
    insert.is_featured = sponsorData.featured || false;
    insert.sponsor_name = sponsorData.sponsorName || null;
    insert.sponsor_logo_url = sponsorData.sponsorLogoUrl || null;
  }

  const [market] = await db('multi_markets')
    .insert(insert)
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

  let creatorName = null;
  if (market.created_by) {
    const creator = await db('students').where({ id: market.created_by }).select('name').first();
    creatorName = creator?.name || null;
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

  const participantResult = await db('multi_market_positions')
    .where({ market_id: marketId })
    .countDistinct('student_id as count')
    .first();
  const participantCount = parseInt(participantResult?.count || 0, 10);

  return {
    ...market,
    creator_name: creatorName,
    participant_count: participantCount,
    outcomes: outcomesWithPrices,
  };
}

/**
 * List all open markets with outcomes and prices
 * @returns {object[]} - array of markets with outcomes
 */
async function listOpenMarkets() {
  const markets = await db('multi_markets')
    .where({ status: 'open' })
    .orderBy('is_featured', 'desc')
    .orderBy('is_sponsored', 'desc')
    .orderBy('created_at', 'desc');

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
async function buyPosition(marketId, outcomeId, studentId, amount, sourceRef = null, isSystemSeed = false) {
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

  if (!isSystemSeed) {
    const student = await db('students').where({ id: studentId }).first();
    if (!student) {
      throw new NotFoundError('Student not found');
    }
    if (amount > student.points_balance) {
      const err = new ValidationError(`Insufficient points. You have ${student.points_balance} pts.`);
      err.code = 'INSUFFICIENT_POINTS';
      err.balance = student.points_balance;
      err.attempted = amount;
      throw err;
    }
  }

  const result = await db.transaction(async (trx) => {
    await gamificationService.deductPoints(
      studentId,
      amount,
      'multi_market',
      `Bought ${shares.toFixed(2)} shares in: ${market.title}`,
      marketId
    );

    // Calculate old price before updating shares_sold
    const oldPrices = calculatePrices(sharesSold, market.liquidity_b);
    const oldPrice = oldPrices[outcomeIndex];

    await trx('multi_market_outcomes')
      .where({ id: outcomeId })
      .increment('shares_sold', shares);

    // Calculate new price using the locally updated shares_sold (not a re-fetch from DB)
    const updatedSharesSold = sharesSold.map((s, i) => (i === outcomeIndex ? s + shares : s));
    const newPrices = calculatePrices(updatedSharesSold, market.liquidity_b);
    const newPrice = newPrices[outcomeIndex];

    const [position] = await trx('multi_market_positions')
      .insert({
        market_id: marketId,
        outcome_id: outcomeId,
        student_id: studentId,
        amount,
        shares,
        entry_price: oldPrice,
        payout: 0,
        source_ref: sourceRef,
      })
      .returning('*');

    // Count total predictions on this market after the insert
    const totalPredictionsResult = await trx('multi_market_positions')
      .where({ market_id: marketId })
      .count('id as c')
      .first();
    const totalPredictionsAfter = Number(totalPredictionsResult.c);

    return { position, market, oldPrice, newPrice, totalPredictionsAfter };
  });

  // Compute social ticker OUTSIDE the transaction so it doesn't roll back if the query fails.
  // Skip both telemetry and social ticker work for system-seed trades (house liquidity bootstrap).
  let socialTicker = null;
  if (!isSystemSeed) {
    const { computeSocialTicker } = require('../habit/socialTicker');
    socialTicker = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId,
      totalPredictionsAfter: result.totalPredictionsAfter,
    }).catch((err) => {
      console.error('socialTicker failed:', err);
      return null;
    });
  }

  afterMultiTrade(marketId, studentId);

  if (!isSystemSeed) {
    const chosenOutcome = outcomes[outcomeIndex];
    posthog.capture({
      distinctId: String(studentId),
      event: 'multi_prediction_placed',
      properties: {
        market_id: marketId,
        market_title: market.title,
        outcome_id: outcomeId,
        outcome_label: chosenOutcome?.label,
        amount,
        shares: result.position.shares,
        entry_price: result.position.entry_price,
        source_ref: sourceRef || null,
      },
    });
  }

  return { ...result, socialTicker };
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

  const resolvedMarket = await db.transaction(async (trx) => {
    const winningPositions = await trx('multi_market_positions')
      .where({ market_id: marketId, outcome_id: winningOutcomeId });

    for (const position of winningPositions) {
      const payout = Math.round(position.shares);

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

    const [resolved] = await trx('multi_markets')
      .where({ id: marketId })
      .update({
        status: 'resolved',
        winning_outcome_id: winningOutcomeId,
        resolved_at: trx.fn.now(),
      })
      .returning('*');

    return resolved;
  });

  const winningOutcome = await db('multi_market_outcomes').where({ id: winningOutcomeId }).first();
  const winnerCount = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: winningOutcomeId })
    .count('id as c')
    .first();

  posthog.capture({
    distinctId: 'admin',
    event: 'multi_market_resolved',
    properties: {
      market_id: marketId,
      market_title: resolvedMarket.title,
      winning_outcome_id: winningOutcomeId,
      winning_outcome_label: winningOutcome?.label,
      winner_count: parseInt(winnerCount?.c || 0, 10),
    },
  });

  // Cascade resolution to any crew pools wrapping this market. Public crew
  // pools FK their parent_market_id to multi_markets.id (migration 042) and
  // their predicted_outcome stores the outcome's label, so passing the
  // winning outcome's label is exactly what autoResolvePublicPool expects.
  // Done after the market-resolve transaction commits so pool payouts don't
  // roll back market state, and each pool resolution is its own transaction
  // for isolated error handling.
  try {
    const resolutionService = require('../crews/resolution.service');
    const wrappingPools = await db('crew_pools')
      .where({ parent_market_id: marketId, pool_type: 'public' })
      .whereIn('status', ['open', 'closed']);
    for (const pool of wrappingPools) {
      try {
        await resolutionService.autoResolvePublicPool(pool.id, winningOutcome?.label);
      } catch (e) {
        console.error(`[multi_markets] auto-resolve crew pool ${pool.id} failed:`, e.message);
      }
    }
  } catch (e) {
    // Don't let a crew-side issue affect the market-resolved return value.
    console.error('[multi_markets] crew pool cascade failed:', e.message);
  }

  return resolvedMarket;
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
      'multi_markets.category as market_category',
      'multi_market_outcomes.label as outcome_label'
    )
    .orderBy('multi_market_positions.created_at', 'desc');
}

async function createUserMarket(studentId, { title, outcomes, category, closesAt }) {
  if (!title || title.trim().length < 10 || title.trim().length > 150) {
    throw new ValidationError('Title must be 10-150 characters');
  }
  if (!outcomes || !Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 10) {
    throw new ValidationError('Must have 2-10 outcomes');
  }
  const trimmedOutcomes = outcomes.map(o => o.trim()).filter(Boolean);
  if (trimmedOutcomes.length < 2) {
    throw new ValidationError('Must have at least 2 non-empty outcomes');
  }
  if (new Set(trimmedOutcomes.map(o => o.toLowerCase())).size !== trimmedOutcomes.length) {
    throw new ValidationError('Outcomes must be unique');
  }
  for (const label of trimmedOutcomes) {
    if (label.length > 60) throw new ValidationError('Each outcome must be 60 characters or less');
  }
  if (closesAt) {
    const closeDate = new Date(closesAt);
    if (isNaN(closeDate.getTime()) || closeDate <= new Date()) {
      throw new ValidationError('Closing time must be in the future');
    }
  }

  const activeCount = await db('multi_markets')
    .where({ created_by: studentId, status: 'open' })
    .count('id as count')
    .first();
  if (parseInt(activeCount.count, 10) >= 3) {
    throw new ValidationError('You can only have 3 active markets at a time');
  }

  const b = await getAutoLiquidityB();

  await gamificationService.deductPoints(
    studentId,
    15,
    'market_creation_fee',
    `Created market: ${title.trim()}`,
    null
  );

  const [market] = await db('multi_markets')
    .insert({
      title: title.trim(),
      liquidity_b: b,
      status: 'open',
      created_by: studentId,
      creator_fee_percent: 5,
      category: category?.trim() || null,
      closes_at: closesAt ? new Date(closesAt) : null,
    })
    .returning('*');

  for (const label of trimmedOutcomes) {
    await db('multi_market_outcomes')
      .insert({ market_id: market.id, label, shares_sold: 0 });
  }

  await seedMarketLiquidity(market.id);

  return getMarketWithOdds(market.id);
}

async function resolveUserMarket(marketId, outcomeId, studentId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'open') throw new ValidationError('Market is not open');
  if (market.created_by !== studentId) throw new ValidationError('Only the market creator can resolve this market');

  const outcome = await db('multi_market_outcomes').where({ id: outcomeId, market_id: marketId }).first();
  if (!outcome) throw new ValidationError('Invalid outcome for this market');

  const resolved = await resolveMarket(marketId, outcomeId);

  const volumeResult = await db('multi_market_positions')
    .where({ market_id: marketId })
    .sum('amount as total_volume')
    .first();
  const totalVolume = parseInt(volumeResult?.total_volume || 0, 10);
  const creatorFee = Math.floor(totalVolume * (market.creator_fee_percent / 100));

  if (creatorFee > 0) {
    await gamificationService.addPoints(
      studentId,
      creatorFee,
      'market_creator_reward',
      `Creator reward for: ${market.title}`,
      marketId
    );
  }

  return { ...resolved, creatorFee };
}

async function getHouseAccountId() {
  return db.transaction(async (trx) => {
    const flagged = await trx('students').where({ is_system: true }).first();
    if (flagged) return flagged.id;

    // The is_system row is missing. It may have been deleted, or migration 021
    // never ran. Reclaim the legacy 'system' phone row if it still exists,
    // otherwise create a fresh one.
    const legacy = await trx('students').where({ phone_number: 'system' }).first();
    if (legacy) {
      await trx('students').where({ id: legacy.id }).update({ is_system: true });
      return legacy.id;
    }

    const [created] = await trx('students')
      .insert({
        name: 'IroyinMarket',
        phone_number: 'system',
        is_system: true,
        points_balance: 999999,
        is_onboarded: true,
        is_banned: false,
      })
      .returning('id');
    return created.id;
  });
}

async function seedMarketLiquidity(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  const seedAmount = Math.max(3, Math.round(market.liquidity_b * 0.1));
  const houseId = await getHouseAccountId();
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  for (const outcome of outcomes) {
    await buyPosition(marketId, outcome.id, houseId, seedAmount, null, true);
  }
}

async function getPortfolio(studentId) {
  const positions = await db('multi_market_positions')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
    .where({ 'multi_market_positions.student_id': studentId })
    .select(
      'multi_market_positions.id',
      'multi_market_positions.market_id',
      'multi_market_positions.outcome_id',
      'multi_market_positions.amount',
      'multi_market_positions.shares',
      'multi_market_positions.payout',
      'multi_market_positions.entry_price',
      'multi_market_positions.created_at',
      'multi_markets.title as market_title',
      'multi_markets.status as market_status',
      'multi_markets.liquidity_b',
      'multi_markets.winning_outcome_id',
      'multi_market_outcomes.label as outcome_label'
    )
    .orderBy('multi_market_positions.created_at', 'desc');

  const openPositions = [];
  const resolvedPositions = [];

  for (const pos of positions) {
    if (pos.market_status === 'open') {
      const outcomes = await db('multi_market_outcomes')
        .where({ market_id: pos.market_id })
        .orderBy('created_at', 'asc');
      const sharesSold = outcomes.map(o => o.shares_sold);
      const prices = calculatePrices(sharesSold, pos.liquidity_b);
      const outcomeIndex = outcomes.findIndex(o => o.id === pos.outcome_id);
      const currentPrice = outcomeIndex >= 0 ? prices[outcomeIndex] : 0;
      const unrealizedPnl = (currentPrice * pos.shares) - pos.amount;

      openPositions.push({
        id: pos.id,
        market_id: pos.market_id,
        market_title: pos.market_title,
        outcome_id: pos.outcome_id,
        outcome_label: pos.outcome_label,
        entry_price: pos.entry_price,
        current_price: currentPrice,
        shares: pos.shares,
        amount: pos.amount,
        unrealized_pnl: Math.round(unrealizedPnl * 100) / 100,
        created_at: pos.created_at,
      });
    } else {
      const won = pos.winning_outcome_id === pos.outcome_id;
      resolvedPositions.push({
        id: pos.id,
        market_id: pos.market_id,
        market_title: pos.market_title,
        outcome_label: pos.outcome_label,
        entry_price: pos.entry_price,
        amount: pos.amount,
        payout: pos.payout,
        won,
        profit: won ? pos.payout - pos.amount : -pos.amount,
        created_at: pos.created_at,
      });
    }
  }

  return { open: openPositions, resolved: resolvedPositions };
}

async function approveMarket(marketId, adminId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'pending') throw new ValidationError('Market is not pending approval');
  await db('multi_markets').where({ id: marketId }).update({ status: 'open' });
  return { ok: true };
}

async function rejectMarket(marketId, adminId, reason) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'pending') throw new ValidationError('Market is not pending approval');
  await db('multi_markets').where({ id: marketId }).update({ status: 'rejected' });
  return { ok: true };
}

module.exports = {
  logSumExp,
  calculatePrices,
  calculateCost,
  calculateSharesForAmount,
  createMarket,
  createUserMarket,
  addOutcome,
  removeOutcome,
  getMarketWithOdds,
  listOpenMarkets,
  buyPosition,
  resolveMarket,
  resolveUserMarket,
  getStudentPositions,
  getPortfolio,
  getAutoLiquidityB,
  seedMarketLiquidity,
  getHouseAccountId,
  approveMarket,
  rejectMarket,
};
