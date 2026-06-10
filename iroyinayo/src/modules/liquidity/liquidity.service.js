const db = require('../../config/database');
const liquidityConfig = require('./liquidity.config');
const adminAdapter = require('./adapters/admin.adapter');
const oddsApiAdapter = require('./adapters/oddsApi.adapter');
const gamificationService = require('../gamification/gamification.service');
const { getIO } = require('../../socket');

const BALANCE_WARNING_THRESHOLD = 10000;
const BALANCE_CRITICAL_THRESHOLD = 1000;
const MAX_SEED_ITERATIONS = 20;

async function getSystemAccount() {
  const sys = await db('students').where({ is_system: true }).first();
  if (!sys) throw new Error('System account not found. Run migrations.');
  return sys;
}

function findSharesForTargetPriceBinary(yesPool, noPool, side, targetYesPrice) {
  let shares;
  if (side === 'yes') {
    shares = (targetYesPrice * noPool - yesPool * (1 - targetYesPrice)) / (1 - targetYesPrice);
  } else {
    shares = (yesPool / targetYesPrice) - yesPool - noPool;
  }

  shares = Math.max(0, shares);

  const totalPool = yesPool + noPool;
  const b = totalPool / 2;
  const { lmsrCost } = require('../markets/markets.service');
  let cost;
  if (typeof lmsrCost === 'function') {
    cost = lmsrCost(yesPool, noPool, b, side, shares);
  } else {
    cost = shares * (side === 'yes'
      ? yesPool / (yesPool + noPool)
      : noPool / (yesPool + noPool));
  }

  return { shares, cost: Math.max(0, cost) };
}

function findSharesForTargetPriceMulti(sharesSold, b, outcomeIndex, targetPrice) {
  const { calculatePrices } = require('../markets/multiMarkets.service');
  const currentPrices = calculatePrices(sharesSold, b);
  const currentPrice = currentPrices[outcomeIndex];

  if (Math.abs(currentPrice - targetPrice) < 0.005) {
    return { shares: 0, cost: 0 };
  }

  let lo = 0;
  let hi = b * 20;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const newShares = [...sharesSold];
    newShares[outcomeIndex] = sharesSold[outcomeIndex] + mid;
    const newPrices = calculatePrices(newShares, b);

    if (newPrices[outcomeIndex] < targetPrice) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const shares = (lo + hi) / 2;
  const { calculateCost } = require('../markets/multiMarkets.service');
  const cost = calculateCost(sharesSold, b, outcomeIndex, shares);

  return { shares, cost };
}

async function getFairValues(config) {
  if (config.source_type === 'odds_api') {
    const probs = await oddsApiAdapter.getFairValues(config);
    await db('market_liquidity_config').where({ id: config.id }).update({
      target_probabilities: JSON.stringify(probs),
      updated_at: new Date(),
    });
    return probs;
  }
  return adminAdapter.getFairValues(config);
}

async function evaluate(marketId, marketType, triggeringStudentId) {
  const config = marketType === 'binary'
    ? await liquidityConfig.getByMarketId(marketId)
    : await liquidityConfig.getByMultiMarketId(marketId);

  if (!config) return { action: 'no_config' };
  if (!config.enabled) return { action: 'disabled' };

  const system = await getSystemAccount();
  if (triggeringStudentId === system.id) return { action: 'self_trade' };

  if (config.last_correction_at) {
    const elapsed = (Date.now() - new Date(config.last_correction_at).getTime()) / 1000;
    if (elapsed < config.cooldown_seconds) return { action: 'cooldown' };
  }

  const freshSystem = await db('students').where({ id: system.id }).first();
  if (freshSystem.points_balance < BALANCE_CRITICAL_THRESHOLD) {
    await liquidityConfig.update(config.id, { enabled: false });
    emitSocket('liquidity:disabled', { marketId, reason: 'critical_balance' });
    return { action: 'disabled_low_balance' };
  }
  if (freshSystem.points_balance < BALANCE_WARNING_THRESHOLD) {
    emitSocket('liquidity:warning', { message: 'System balance low', systemBalance: freshSystem.points_balance });
  }

  const fairValues = await getFairValues(config);

  if (marketType === 'binary') {
    return evaluateBinary(marketId, config, fairValues, system.id);
  }
  return evaluateMulti(marketId, config, fairValues, system.id);
}

async function evaluateBinary(marketId, config, fairValues, systemId) {
  const market = await db('markets').where({ id: marketId }).first();
  if (!market || market.status !== 'open') return { action: 'market_closed' };

  const yesPool = market.yes_pool;
  const noPool = market.no_pool;
  const currentYesPrice = yesPool / (yesPool + noPool);
  const targetYesPrice = fairValues.yes;

  const drift = Math.abs(currentYesPrice - targetYesPrice);
  const threshold = parseFloat(config.drift_threshold);

  if (drift < threshold) return { action: 'within_threshold' };

  const correctionStrength = parseFloat(config.correction_strength);
  const targetMove = drift * correctionStrength;
  const correctedYesPrice = currentYesPrice > targetYesPrice
    ? currentYesPrice - targetMove
    : currentYesPrice + targetMove;

  const side = currentYesPrice > targetYesPrice ? 'no' : 'yes';
  const { shares, cost } = findSharesForTargetPriceBinary(yesPool, noPool, side, correctedYesPrice);

  if (shares <= 0) return { action: 'no_correction_needed' };

  const amount = Math.min(Math.ceil(cost), config.max_correction_amount);
  if (amount <= 0) return { action: 'no_correction_needed' };

  await gamificationService.deductPoints(systemId, amount, 'liquidity_bot', `Bot correction on market ${marketId}`, marketId);

  const { calculateSharesOut, newPoolsAfterBuy } = require('../markets/markets.service');
  const actualShares = calculateSharesOut(yesPool, noPool, side, amount);
  const pools = newPoolsAfterBuy(yesPool, noPool, side, actualShares);

  await db('markets').where({ id: marketId }).update({
    yes_pool: pools.yes_pool,
    no_pool: pools.no_pool,
  });

  await db('market_positions').insert({
    market_id: marketId,
    student_id: systemId,
    side,
    amount,
    shares: actualShares,
  });

  await liquidityConfig.updateLastCorrectionAt(config.id);

  const newYesPrice = pools.yes_pool / (pools.yes_pool + pools.no_pool);
  emitSocket('liquidity:correction', {
    marketId, marketType: 'binary', side, amount, shares: actualShares,
    newPrices: { yes: newYesPrice, no: 1 - newYesPrice },
  });

  return { action: 'corrected', side, amount, shares: actualShares };
}

async function evaluateMulti(marketId, config, fairValues, systemId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market || market.status !== 'open') return { action: 'market_closed' };

  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  const { calculatePrices, calculateSharesForAmount } = require('../markets/multiMarkets.service');
  const sharesSold = outcomes.map(o => o.shares_sold);
  const currentPrices = calculatePrices(sharesSold, market.liquidity_b);

  let maxDrift = 0;
  let targetOutcomeIndex = -1;
  let targetOutcomeId = null;

  for (let i = 0; i < outcomes.length; i++) {
    const fair = fairValues[outcomes[i].id] || 0;
    const drift = fair - currentPrices[i];
    if (drift > maxDrift) {
      maxDrift = drift;
      targetOutcomeIndex = i;
      targetOutcomeId = outcomes[i].id;
    }
  }

  const threshold = parseFloat(config.drift_threshold);
  if (maxDrift < threshold) return { action: 'within_threshold' };

  const correctionStrength = parseFloat(config.correction_strength);
  const targetMove = maxDrift * correctionStrength;
  const targetPrice = currentPrices[targetOutcomeIndex] + targetMove;

  const { shares, cost } = findSharesForTargetPriceMulti(
    sharesSold, market.liquidity_b, targetOutcomeIndex, targetPrice
  );

  if (shares <= 0) return { action: 'no_correction_needed' };

  const amount = Math.min(Math.ceil(cost), config.max_correction_amount);
  if (amount <= 0) return { action: 'no_correction_needed' };

  await gamificationService.deductPoints(systemId, amount, 'liquidity_bot', `Bot correction on multi-market ${marketId}`, marketId);

  const actualShares = calculateSharesForAmount(sharesSold, market.liquidity_b, targetOutcomeIndex, amount);

  await db('multi_market_outcomes')
    .where({ id: targetOutcomeId })
    .increment('shares_sold', actualShares);

  await db('multi_market_positions').insert({
    market_id: marketId,
    outcome_id: targetOutcomeId,
    student_id: systemId,
    amount,
    shares: actualShares,
    entry_price: currentPrices[targetOutcomeIndex],
    payout: 0,
  });

  await liquidityConfig.updateLastCorrectionAt(config.id);

  const updatedOutcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');
  const newPrices = calculatePrices(updatedOutcomes.map(o => o.shares_sold), market.liquidity_b);
  const priceMap = {};
  updatedOutcomes.forEach((o, i) => { priceMap[o.id] = newPrices[i]; });

  emitSocket('liquidity:correction', {
    marketId, marketType: 'multi', outcomeId: targetOutcomeId, amount, shares: actualShares,
    newPrices: priceMap,
  });

  return { action: 'corrected', outcomeId: targetOutcomeId, amount, shares: actualShares };
}

async function seed(marketId, marketType) {
  const config = marketType === 'binary'
    ? await liquidityConfig.getByMarketId(marketId)
    : await liquidityConfig.getByMultiMarketId(marketId);

  if (!config) return { action: 'no_config' };

  const system = await getSystemAccount();
  const fairValues = await getFairValues(config);

  if (marketType === 'binary') {
    return seedBinary(marketId, fairValues, system.id);
  }
  return seedMulti(marketId, config, fairValues, system.id);
}

async function seedBinary(marketId, fairValues, systemId) {
  const market = await db('markets').where({ id: marketId }).first();
  const yesPool = market.yes_pool;
  const noPool = market.no_pool;
  const currentYesPrice = yesPool / (yesPool + noPool);
  const targetYesPrice = fairValues.yes;

  if (Math.abs(currentYesPrice - targetYesPrice) < 0.01) {
    return { action: 'already_at_target' };
  }

  const side = currentYesPrice > targetYesPrice ? 'no' : 'yes';
  const { shares, cost } = findSharesForTargetPriceBinary(yesPool, noPool, side, targetYesPrice);

  if (shares <= 0 || cost <= 0) return { action: 'no_seed_needed' };

  const amount = Math.ceil(cost);
  await gamificationService.deductPoints(systemId, amount, 'liquidity_seed', `Seed market ${marketId}`, marketId);

  const { calculateSharesOut, newPoolsAfterBuy } = require('../markets/markets.service');
  const actualShares = calculateSharesOut(yesPool, noPool, side, amount);
  const pools = newPoolsAfterBuy(yesPool, noPool, side, actualShares);

  await db('markets').where({ id: marketId }).update({
    yes_pool: pools.yes_pool,
    no_pool: pools.no_pool,
  });

  await db('market_positions').insert({
    market_id: marketId,
    student_id: systemId,
    side,
    amount,
    shares: actualShares,
  });

  const newYesPrice = pools.yes_pool / (pools.yes_pool + pools.no_pool);
  emitSocket('liquidity:seeded', {
    marketId, marketType: 'binary',
    prices: { yes: newYesPrice, no: 1 - newYesPrice },
  });

  return { action: 'seeded', side, amount };
}

async function seedMulti(marketId, config, fairValues, systemId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  const { calculatePrices, calculateSharesForAmount } = require('../markets/multiMarkets.service');
  const threshold = parseFloat(config.drift_threshold);

  for (let iteration = 0; iteration < MAX_SEED_ITERATIONS; iteration++) {
    const outcomes = await db('multi_market_outcomes')
      .where({ market_id: marketId })
      .orderBy('created_at', 'asc');
    const sharesSold = outcomes.map(o => o.shares_sold);
    const currentPrices = calculatePrices(sharesSold, market.liquidity_b);

    let maxDeviation = 0;
    let targetIndex = -1;
    let targetOutcomeId = null;

    for (let i = 0; i < outcomes.length; i++) {
      const fair = fairValues[outcomes[i].id] || 0;
      const deviation = fair - currentPrices[i];
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
        targetIndex = i;
        targetOutcomeId = outcomes[i].id;
      }
    }

    if (maxDeviation < threshold) break;

    const targetPrice = fairValues[targetOutcomeId];
    const { shares, cost } = findSharesForTargetPriceMulti(
      sharesSold, market.liquidity_b, targetIndex, targetPrice
    );

    if (shares <= 0 || cost <= 0) break;

    const amount = Math.ceil(cost);
    await gamificationService.deductPoints(systemId, amount, 'liquidity_seed', `Seed multi-market ${marketId}`, marketId);

    const actualShares = calculateSharesForAmount(sharesSold, market.liquidity_b, targetIndex, amount);

    await db('multi_market_outcomes')
      .where({ id: targetOutcomeId })
      .increment('shares_sold', actualShares);

    await db('multi_market_positions').insert({
      market_id: marketId,
      outcome_id: targetOutcomeId,
      student_id: systemId,
      amount,
      shares: actualShares,
      entry_price: currentPrices[targetIndex],
      payout: 0,
    });
  }

  const finalOutcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');
  const finalPrices = calculatePrices(finalOutcomes.map(o => o.shares_sold), market.liquidity_b);
  const priceMap = {};
  finalOutcomes.forEach((o, i) => { priceMap[o.id] = finalPrices[i]; });

  emitSocket('liquidity:seeded', { marketId, marketType: 'multi', prices: priceMap });
  return { action: 'seeded', prices: priceMap };
}

function emitSocket(event, payload) {
  try {
    const io = getIO();
    if (io) io.emit(event, payload);
  } catch (e) {
    // Socket not initialized (e.g., in tests)
  }
}

module.exports = {
  evaluate,
  seed,
  findSharesForTargetPriceBinary,
  findSharesForTargetPriceMulti,
  getSystemAccount,
};
