const cron = require('node-cron');
const db = require('../../config/database');
const { runSimulation } = require('./engine');
const { saveSimulationResult, executeTier1Actions, checkTier2Alerts } = require('./actions');
const { shouldTrigger, isDebounced } = require('./triggers');

const INTERVAL_MINUTES = parseInt(process.env.SIMULATION_INTERVAL_MINUTES || '30', 10);
const NEAR_CLOSE_INTERVAL_MINUTES = parseInt(process.env.NEAR_CLOSE_INTERVAL_MINUTES || '10', 10);
const NEAR_CLOSE_THRESHOLD_HOURS = parseInt(process.env.NEAR_CLOSE_THRESHOLD_HOURS || '2', 10);
const SIMULATION_PATHS = parseInt(process.env.SIMULATION_PATHS || '1000', 10);

async function getMarketWithOutcomes(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) return null;
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');
  return { ...market, outcomes };
}

async function simulateMarket(marketId, triggerType) {
  const market = await getMarketWithOutcomes(marketId);
  if (!market || market.status !== 'open') return;

  const simResult = await runSimulation(market, { paths: SIMULATION_PATHS });
  if (!simResult) return;

  const saved = await saveSimulationResult(marketId, triggerType, simResult, SIMULATION_PATHS);
  await executeTier1Actions(market, simResult, saved.id);
  await checkTier2Alerts(market, simResult, saved.id);
}

async function batchSimulate() {
  const markets = await db('multi_markets').where({ status: 'open' });

  for (const market of markets) {
    if (isDebounced(market.id)) continue;
    try {
      await simulateMarket(market.id, 'cron');
    } catch (err) {
      console.error(`[simulation] batch error for market ${market.id}:`, err.message);
    }
  }
}

async function nearCloseSimulate() {
  const thresholdTime = new Date(Date.now() + NEAR_CLOSE_THRESHOLD_HOURS * 60 * 60 * 1000);

  const markets = await db('multi_markets')
    .where({ status: 'open' })
    .whereNotNull('closes_at')
    .where('closes_at', '<=', thresholdTime);

  for (const market of markets) {
    if (isDebounced(market.id)) continue;
    try {
      await simulateMarket(market.id, 'cron');
    } catch (err) {
      console.error(`[simulation] near-close error for market ${market.id}:`, err.message);
    }
  }
}

function attachSocketListeners(io) {
  const originalEmit = io.emit.bind(io);
  io.emit = function (event, ...args) {
    if (event === 'odds:update') {
      const { marketId, outcomes } = args[0] || {};
      if (marketId && outcomes) {
        handleOddsUpdate(marketId, outcomes);
      }
    }
    return originalEmit(event, ...args);
  };
}

async function handleOddsUpdate(marketId, newOutcomes) {
  const market = await getMarketWithOutcomes(marketId);
  if (!market) return;

  let maxSwing = 0;
  for (const newO of newOutcomes) {
    const old = market.outcomes.find((o) => o.id === newO.id);
    if (old) {
      const oldPrice = old.price || 0;
      const newPrice = newO.price || 0;
      const swing = Math.abs(newPrice - oldPrice);
      if (swing > maxSwing) maxSwing = swing;
    }
  }

  const triggered = shouldTrigger(marketId, 'trade', { priceSwing: maxSwing });
  if (triggered) {
    setImmediate(() => simulateMarket(marketId, 'event').catch((err) =>
      console.error(`[simulation] event trigger error for ${marketId}:`, err.message)
    ));
  }
}

function startScheduler(io) {
  console.log(`[simulation] Starting scheduler: batch every ${INTERVAL_MINUTES}m, near-close every ${NEAR_CLOSE_INTERVAL_MINUTES}m`);

  cron.schedule(`*/${INTERVAL_MINUTES} * * * *`, async () => {
    console.log('[simulation] Running batch simulation...');
    try {
      await batchSimulate();
    } catch (err) {
      console.error('[simulation] Batch simulation failed:', err.message);
    }
  });

  cron.schedule(`*/${NEAR_CLOSE_INTERVAL_MINUTES} * * * *`, async () => {
    try {
      await nearCloseSimulate();
    } catch (err) {
      console.error('[simulation] Near-close simulation failed:', err.message);
    }
  });

  // Purge simulation results older than 30 days — runs daily at 3am
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await db('market_simulations').where('run_at', '<', cutoff).del();
      if (deleted > 0) console.log(`[simulation] Purged ${deleted} old simulation records`);
    } catch (err) {
      console.error('[simulation] Purge failed:', err.message);
    }
  });

  if (io) {
    attachSocketListeners(io);
  }
}

module.exports = { startScheduler, batchSimulate, nearCloseSimulate, simulateMarket, getMarketWithOutcomes };
