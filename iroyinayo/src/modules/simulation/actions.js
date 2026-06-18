const db = require('../../config/database');
const { calculatePrices } = require('../markets/multiMarkets.service');

const DIVERGENCE_THRESHOLD = parseFloat(process.env.DIVERGENCE_THRESHOLD || '0.15');
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.95');
const MANIPULATION_VOLUME_THRESHOLD = parseFloat(process.env.MANIPULATION_VOLUME_THRESHOLD || '0.60');
const STUCK_HOURS_THRESHOLD = parseInt(process.env.STUCK_HOURS_THRESHOLD || '48', 10);

async function saveSimulationResult(marketId, triggerType, simResult, paths) {
  const [row] = await db('market_simulations').insert({
    market_id: marketId,
    trigger_type: triggerType,
    paths_run: paths,
    results: JSON.stringify(simResult.results),
    confidence_score: simResult.confidenceScore,
    external_anchor_used: simResult.externalAnchorUsed,
    external_odds: simResult.externalOdds ? JSON.stringify(simResult.externalOdds) : null,
  }).returning('*');
  return row;
}

async function executeTier1Actions(market, simResult, simulationId) {
  if (!simResult.externalAnchorUsed) return;

  const outcomes = market.outcomes || [];
  const sharesSold = outcomes.map((o) => o.shares_sold || 0);
  const currentPrices = calculatePrices(sharesSold, market.liquidity_b);

  const simOutcomes = simResult.results.outcomes;
  let maxDivergence = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const simProb = simOutcomes[i]?.mean_prob || 0;
    const divergence = Math.abs(currentPrices[i] - simProb);
    if (divergence > maxDivergence) maxDivergence = divergence;
  }

  if (maxDivergence > DIVERGENCE_THRESHOLD) {
    const liquidityService = require('../liquidity/liquidity.service');
    try {
      await liquidityService.evaluate(market.id, 'multi', null);
    } catch (err) {
      console.error('[simulation] liquidity correction failed:', err.message);
    }
  }
}

async function checkTier2Alerts(market, simResult, simulationId) {
  await checkManipulation(market, simResult, simulationId);
  await checkStuckMarket(market, simulationId);
  await checkEarlyResolution(market, simResult, simulationId);
}

async function checkManipulation(market, simResult, simulationId) {
  if (!simResult.externalAnchorUsed) return;

  const systemAccount = await db('students').where({ is_system: true }).first();
  const positions = await db('multi_market_positions')
    .where({ market_id: market.id })
    .modify((qb) => {
      if (systemAccount) qb.whereNot({ student_id: systemAccount.id });
    })
    .select('student_id')
    .sum('amount as total_amount')
    .groupBy('student_id');

  const totalVolume = positions.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
  if (totalVolume === 0) return;

  for (const pos of positions) {
    const ratio = parseFloat(pos.total_amount) / totalVolume;
    if (ratio > MANIPULATION_VOLUME_THRESHOLD) {
      const outcomes = market.outcomes || [];
      const currentPrices = calculatePrices(outcomes.map((o) => o.shares_sold || 0), market.liquidity_b);
      const simProbs = simResult.results.outcomes.map((o) => o.mean_prob);
      const maxDiv = Math.max(...currentPrices.map((p, i) => Math.abs(p - (simProbs[i] || 0))));

      if (maxDiv > 0.20) {
        await createAlert(market.id, simulationId, 'manipulation', 'high', {
          trader_id: pos.student_id,
          volume_ratio: ratio,
          divergence: maxDiv,
        });
      }
    }
  }
}

async function checkStuckMarket(market, simulationId) {
  const lastTrade = await db('multi_market_positions')
    .where({ market_id: market.id })
    .orderBy('created_at', 'desc')
    .first();

  if (!lastTrade) return;

  const hoursSinceLastTrade = (Date.now() - new Date(lastTrade.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastTrade < STUCK_HOURS_THRESHOLD) return;

  const uniqueTraders = await db('multi_market_positions')
    .where({ market_id: market.id })
    .countDistinct('student_id as count')
    .first();

  if (parseInt(uniqueTraders.count) < 3) {
    await createAlert(market.id, simulationId, 'stuck', 'medium', {
      hours_since_last_trade: Math.round(hoursSinceLastTrade),
      unique_traders: parseInt(uniqueTraders.count),
    });
  }
}

async function checkEarlyResolution(market, simResult, simulationId) {
  if (simResult.confidenceScore >= CONFIDENCE_THRESHOLD) {
    const leading = simResult.results.outcomes.reduce(
      (best, o) => o.mean_prob > best.mean_prob ? o : best
    );
    await createAlert(market.id, simulationId, 'early_resolution', 'low', {
      confidence_score: simResult.confidenceScore,
      leading_outcome: leading.label,
      leading_probability: leading.mean_prob,
    });
  }
}

async function createAlert(marketId, simulationId, alertType, severity, details) {
  const existing = await db('simulation_alerts')
    .where({ market_id: marketId, alert_type: alertType, status: 'pending' })
    .first();

  if (existing) return;

  await db('simulation_alerts').insert({
    market_id: marketId,
    simulation_id: simulationId,
    alert_type: alertType,
    severity,
    details: JSON.stringify(details),
  });
}

module.exports = { saveSimulationResult, executeTier1Actions, checkTier2Alerts, createAlert };
