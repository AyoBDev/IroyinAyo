const db = require('../../config/database');
const { calculatePrices } = require('../markets/multiMarkets.service');
const { getExternalOdds, calculateAnchorStrength, getAnchorProbabilities } = require('./anchoring');

const DEFAULT_PATHS = 1000;

function generatePath(sharesSold, b, outcomes, steps, anchorProbs, anchorStrength, tradingProfile) {
  let currentShares = [...sharesSold];
  const { avgAmount, volumePerStep, directionalBias } = tradingProfile;

  for (let step = 0; step < steps; step++) {
    const tradesThisStep = Math.round(volumePerStep * (0.5 + Math.random()));

    for (let t = 0; t < tradesThisStep; t++) {
      let outcomeIndex;

      if (anchorProbs && Math.random() < anchorStrength) {
        outcomeIndex = weightedRandom(anchorProbs);
      } else {
        outcomeIndex = weightedRandom(directionalBias);
      }

      const amount = avgAmount * (0.5 + Math.random());
      const sharesToAdd = amount / (b * 0.1 + 1);
      currentShares[outcomeIndex] += sharesToAdd;
    }
  }

  return calculatePrices(currentShares, b);
}

function weightedRandom(weights) {
  const total = weights.reduce((sum, w) => sum + (w || 0), 0);
  if (total === 0) return Math.floor(Math.random() * weights.length);

  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] || 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

async function getTradingProfile(marketId, outcomes) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentTrades = await db('multi_market_positions')
    .where({ market_id: marketId })
    .where('created_at', '>=', oneDayAgo)
    .select('outcome_id', 'amount');

  if (recentTrades.length === 0) {
    return {
      avgAmount: 10,
      volumePerStep: 0.5,
      directionalBias: outcomes.map(() => 1 / outcomes.length),
    };
  }

  const avgAmount = recentTrades.reduce((sum, t) => sum + t.amount, 0) / recentTrades.length;
  const volumePerStep = Math.min(recentTrades.length / 24, 5);

  const outcomeCounts = {};
  for (const t of recentTrades) {
    outcomeCounts[t.outcome_id] = (outcomeCounts[t.outcome_id] || 0) + 1;
  }
  const total = recentTrades.length;
  const directionalBias = outcomes.map((o) => (outcomeCounts[o.id] || 0) / total);

  return { avgAmount, volumePerStep, directionalBias };
}

function computeResults(allFinalPrices, outcomes) {
  const n = allFinalPrices.length;
  const outcomeResults = outcomes.map((o, idx) => {
    const probs = allFinalPrices.map((p) => p[idx]).sort((a, b) => a - b);
    const mean = probs.reduce((s, v) => s + v, 0) / n;
    const ci5 = probs[Math.floor(n * 0.05)];
    const ci95 = probs[Math.floor(n * 0.95)];
    return { id: o.id, label: o.label, mean_prob: mean, ci_low: ci5, ci_high: ci95 };
  });

  const leading = outcomeResults.reduce((best, o) => o.mean_prob > best.mean_prob ? o : best);
  const ciWidth = leading.ci_high - leading.ci_low;
  const confidenceScore = Math.max(0, Math.min(1, leading.mean_prob * (1 - ciWidth)));

  return { outcomes: outcomeResults, confidenceScore };
}

async function runSimulation(market, { paths = DEFAULT_PATHS } = {}) {
  const outcomes = market.outcomes || [];
  if (outcomes.length < 2) return null;

  const sharesSold = outcomes.map((o) => o.shares_sold || 0);
  const b = market.liquidity_b;

  const externalOdds = await getExternalOdds(market);
  const anchorStrength = calculateAnchorStrength(externalOdds, market);
  const anchorProbs = getAnchorProbabilities(externalOdds, outcomes);
  const tradingProfile = await getTradingProfile(market.id, outcomes);

  const hoursToClose = market.closes_at
    ? Math.max(1, (new Date(market.closes_at) - Date.now()) / (1000 * 60 * 60))
    : 168;
  const steps = Math.min(Math.ceil(hoursToClose), 48);

  const allFinalPrices = [];
  for (let i = 0; i < paths; i++) {
    const finalPrices = generatePath(sharesSold, b, outcomes, steps, anchorProbs, anchorStrength, tradingProfile);
    allFinalPrices.push(finalPrices);
  }

  const { outcomes: outcomeResults, confidenceScore } = computeResults(allFinalPrices, outcomes);

  return {
    results: { outcomes: outcomeResults },
    confidenceScore,
    externalAnchorUsed: !!externalOdds,
    externalOdds: externalOdds ? {
      source: externalOdds.source,
      outcomes: outcomeResults.map((o) => ({
        label: o.label,
        probability: anchorProbs?.[outcomes.findIndex((oc) => oc.id === o.id)] || null,
      })),
    } : null,
  };
}

module.exports = { runSimulation, generatePath, weightedRandom, computeResults, getTradingProfile };
