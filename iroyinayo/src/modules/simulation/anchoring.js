const db = require('../../config/database');
const oddsApiAdapter = require('../liquidity/adapters/oddsApi.adapter');

async function getExternalOdds(market) {
  const config = await db('market_liquidity_config')
    .where({ multi_market_id: market.id })
    .first();

  if (!config || config.source_type !== 'odds_api') {
    return null;
  }

  try {
    const probs = await oddsApiAdapter.getFairValues(config);
    if (!probs || Object.keys(probs).length === 0) return null;
    return { source: 'odds_api', probabilities: probs };
  } catch {
    return null;
  }
}

function calculateAnchorStrength(externalOdds, market) {
  if (!externalOdds) return 0;

  const outcomes = market.outcomes || [];
  const externalKeys = Object.keys(externalOdds.probabilities);
  const matchedOutcomes = outcomes.filter((o) =>
    externalKeys.some((k) => k.toLowerCase() === o.label.toLowerCase())
  );

  const matchRatio = matchedOutcomes.length / outcomes.length;

  if (matchRatio >= 0.8) return 0.8;
  if (matchRatio >= 0.4) return 0.5;
  return 0;
}

function getAnchorProbabilities(externalOdds, outcomes) {
  if (!externalOdds) return null;
  const probs = externalOdds.probabilities;
  return outcomes.map((o) => {
    const key = Object.keys(probs).find(
      (k) => k.toLowerCase() === o.label.toLowerCase()
    );
    return key ? probs[key] : null;
  });
}

module.exports = { getExternalOdds, calculateAnchorStrength, getAnchorProbabilities };
