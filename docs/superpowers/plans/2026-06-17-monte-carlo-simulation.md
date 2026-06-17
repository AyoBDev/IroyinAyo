# Monte Carlo Simulation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal Monte Carlo simulation engine that forecasts market outcomes, drives liquidity corrections, and flags market health issues for admin review.

**Architecture:** Dedicated `src/modules/simulation/` module with 6 focused files. Cron-based batch processing + event-driven triggers via Socket.io. Results stored in two new DB tables. Integrates with existing liquidity bot for automated corrections and admin routes for alerts.

**Tech Stack:** Node.js, Knex (PostgreSQL), node-cron, Socket.io (listener), existing LMSR math from multiMarkets.service

---

## File Structure

```
iroyinayo/src/modules/simulation/
├── engine.js             — core Monte Carlo: runSimulation(market) → results
├── anchoring.js          — external odds fetching + anchor weight calculation
├── triggers.js           — event listeners + debounce logic
├── actions.js            — tier 1 automated actions + tier 2 alert creation
├── scheduler.js          — cron setup (batch + near-close)
└── simulation.routes.js  — admin API: alerts CRUD, simulation results

iroyinayo/migrations/
└── 024_create_simulation_tables.js  — market_simulations + simulation_alerts
```

---

### Task 1: Database Migration

**Files:**
- Create: `iroyinayo/migrations/024_create_simulation_tables.js`

- [ ] **Step 1: Create the migration file**

```javascript
exports.up = async function (knex) {
  await knex.schema.createTable('market_simulations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.timestamp('run_at').notNullable().defaultTo(knex.fn.now());
    table.enu('trigger_type', ['cron', 'event']).notNullable();
    table.integer('paths_run').notNullable().defaultTo(1000);
    table.jsonb('results').notNullable();
    table.decimal('confidence_score', 4, 3).notNullable();
    table.boolean('external_anchor_used').notNullable().defaultTo(false);
    table.jsonb('external_odds');
  });

  await knex.schema.createTable('simulation_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
    table.uuid('simulation_id').notNullable().references('id').inTable('market_simulations').onDelete('CASCADE');
    table.enu('alert_type', ['manipulation', 'stuck', 'early_resolution']).notNullable();
    table.enu('severity', ['low', 'medium', 'high']).notNullable();
    table.jsonb('details').notNullable();
    table.enu('status', ['pending', 'acknowledged', 'acted_on', 'dismissed']).notNullable().defaultTo('pending');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('simulation_alerts');
  await knex.schema.dropTableIfExists('market_simulations');
};
```

- [ ] **Step 2: Verify migration runs**

Run:
```bash
cd iroyinayo && npx knex migrate:latest --env development 2>&1 | tail -5
```
Expected: Migration completes (or shows "already up to date" if no DB configured locally — that's OK).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/migrations/024_create_simulation_tables.js
git commit -m "feat(simulation): add market_simulations and simulation_alerts tables"
```

---

### Task 2: Anchoring Module

**Files:**
- Create: `iroyinayo/src/modules/simulation/anchoring.js`

- [ ] **Step 1: Create the anchoring module**

```javascript
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
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/anchoring')" 2>&1
```
Expected: No output (clean require) or a database connection error (acceptable — no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/anchoring.js
git commit -m "feat(simulation): add anchoring module for external odds integration"
```

---

### Task 3: Core Simulation Engine

**Files:**
- Create: `iroyinayo/src/modules/simulation/engine.js`

- [ ] **Step 1: Create the engine module**

```javascript
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
    externalOdds: externalOdds ? { source: externalOdds.source, outcomes: outcomeResults.map((o) => ({ label: o.label, probability: anchorProbs?.[outcomes.findIndex((oc) => oc.id === o.id)] || null })) } : null,
  };
}

module.exports = { runSimulation, generatePath, weightedRandom, computeResults, getTradingProfile };
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/engine')" 2>&1
```
Expected: Clean require or DB connection error (no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/engine.js
git commit -m "feat(simulation): add core Monte Carlo engine with path generation and LMSR integration"
```

---

### Task 4: Actions Module

**Files:**
- Create: `iroyinayo/src/modules/simulation/actions.js`

- [ ] **Step 1: Create the actions module**

```javascript
const db = require('../../config/database');
const { calculatePrices } = require('../markets/multiMarkets.service');
const { getIO } = require('../../socket');

const DIVERGENCE_THRESHOLD = parseFloat(process.env.DIVERGENCE_THRESHOLD || '0.15');
const MAX_CORRECTION_PER_WINDOW = parseFloat(process.env.MAX_CORRECTION_PER_WINDOW || '0.05');
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

  const positions = await db('multi_market_positions')
    .where({ market_id: market.id })
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
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/actions')" 2>&1
```
Expected: Clean require or DB connection error.

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/actions.js
git commit -m "feat(simulation): add actions module with tier 1 corrections and tier 2 alerts"
```

---

### Task 5: Triggers Module

**Files:**
- Create: `iroyinayo/src/modules/simulation/triggers.js`

- [ ] **Step 1: Create the triggers module**

```javascript
const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_MS || '60000', 10);
const PRICE_SWING_THRESHOLD = 0.10;
const VOLUME_SPIKE_COUNT = 5;
const VOLUME_SPIKE_WINDOW_MS = 5 * 60 * 1000;

const pendingSimulations = new Map();
const recentTrades = new Map();

function shouldTrigger(marketId, eventType, data) {
  if (eventType === 'trade') {
    trackTrade(marketId);

    if (data.priceSwing && Math.abs(data.priceSwing) > PRICE_SWING_THRESHOLD) {
      return scheduleSimulation(marketId);
    }

    if (hasVolumeSpike(marketId)) {
      return scheduleSimulation(marketId);
    }
  }

  if (eventType === 'external_data_changed') {
    return scheduleSimulation(marketId);
  }

  if (eventType === 'near_close') {
    return scheduleSimulation(marketId);
  }

  return false;
}

function trackTrade(marketId) {
  const now = Date.now();
  if (!recentTrades.has(marketId)) {
    recentTrades.set(marketId, []);
  }
  const trades = recentTrades.get(marketId);
  trades.push(now);

  const cutoff = now - VOLUME_SPIKE_WINDOW_MS;
  const filtered = trades.filter((t) => t > cutoff);
  recentTrades.set(marketId, filtered);
}

function hasVolumeSpike(marketId) {
  const trades = recentTrades.get(marketId) || [];
  return trades.length >= VOLUME_SPIKE_COUNT;
}

function scheduleSimulation(marketId) {
  if (pendingSimulations.has(marketId)) {
    return false;
  }

  pendingSimulations.set(marketId, true);
  setTimeout(() => {
    pendingSimulations.delete(marketId);
  }, DEBOUNCE_MS);

  return true;
}

function isDebounced(marketId) {
  return pendingSimulations.has(marketId);
}

function reset() {
  pendingSimulations.clear();
  recentTrades.clear();
}

module.exports = { shouldTrigger, isDebounced, reset, trackTrade, hasVolumeSpike };
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/triggers')" 2>&1
```
Expected: No output (clean require).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/triggers.js
git commit -m "feat(simulation): add triggers module with debounce and volume spike detection"
```

---

### Task 6: Scheduler Module

**Files:**
- Create: `iroyinayo/src/modules/simulation/scheduler.js`

- [ ] **Step 1: Create the scheduler module**

```javascript
const cron = require('node-cron');
const db = require('../../config/database');
const { runSimulation } = require('./engine');
const { saveSimulationResult, executeTier1Actions, checkTier2Alerts } = require('./actions');
const { shouldTrigger, isDebounced } = require('./triggers');
const { getIO } = require('../../socket');

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
  io.on('connection', () => {});

  const originalEmit = io.emit.bind(io);
  const wrappedEmit = function (event, ...args) {
    if (event === 'odds:update') {
      const { marketId, outcomes } = args[0] || {};
      if (marketId && outcomes) {
        handleOddsUpdate(marketId, outcomes);
      }
    }
    return originalEmit(event, ...args);
  };

  io.emit = wrappedEmit;
}

async function handleOddsUpdate(marketId, newOutcomes) {
  const market = await getMarketWithOutcomes(marketId);
  if (!market) return;

  const oldPrices = market.outcomes.map((o) => o.shares_sold);
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

  if (io) {
    attachSocketListeners(io);
  }
}

module.exports = { startScheduler, batchSimulate, nearCloseSimulate, simulateMarket, getMarketWithOutcomes };
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/scheduler')" 2>&1
```
Expected: Clean require or connection error.

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/scheduler.js
git commit -m "feat(simulation): add scheduler with cron batch processing and socket event triggers"
```

---

### Task 7: Admin API Routes

**Files:**
- Create: `iroyinayo/src/modules/simulation/simulation.routes.js`

- [ ] **Step 1: Create the routes file**

```javascript
const router = require('express').Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');

router.get('/alerts', authenticate, async (req, res, next) => {
  try {
    const { status, alert_type, market_id } = req.query;
    let query = db('simulation_alerts')
      .join('multi_markets', 'simulation_alerts.market_id', 'multi_markets.id')
      .select(
        'simulation_alerts.*',
        'multi_markets.title as market_title'
      )
      .orderBy('simulation_alerts.created_at', 'desc');

    if (status) query = query.where('simulation_alerts.status', status);
    if (alert_type) query = query.where('simulation_alerts.alert_type', alert_type);
    if (market_id) query = query.where('simulation_alerts.market_id', market_id);

    const alerts = await query.limit(100);
    res.json(alerts);
  } catch (err) { next(err); }
});

router.patch('/alerts/:id', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['acknowledged', 'acted_on', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = { status };
    if (status === 'acted_on' || status === 'dismissed') {
      update.resolved_at = new Date();
    }

    const [alert] = await db('simulation_alerts')
      .where({ id: req.params.id })
      .update(update)
      .returning('*');

    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
});

router.get('/markets/:marketId/results', authenticate, async (req, res, next) => {
  try {
    const results = await db('market_simulations')
      .where({ market_id: req.params.marketId })
      .orderBy('run_at', 'desc')
      .limit(20);
    res.json(results);
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const totalRuns = await db('market_simulations').count('id as count').first();
    const pendingAlerts = await db('simulation_alerts').where({ status: 'pending' }).count('id as count').first();
    const recentRuns = await db('market_simulations')
      .where('run_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('id as count').first();

    res.json({
      total_simulations: parseInt(totalRuns.count),
      pending_alerts: parseInt(pendingAlerts.count),
      simulations_last_24h: parseInt(recentRuns.count),
    });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd iroyinayo && node -e "require('./src/modules/simulation/simulation.routes')" 2>&1
```
Expected: Clean require or connection error.

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/simulation/simulation.routes.js
git commit -m "feat(simulation): add admin API routes for alerts and simulation results"
```

---

### Task 8: Wire Up Module to App

**Files:**
- Modify: `iroyinayo/src/app.js`
- Modify: `iroyinayo/src/index.js`

- [ ] **Step 1: Register routes in app.js**

In `iroyinayo/src/app.js`, after the existing line:
```javascript
app.use('/api/admin/liquidity', liquidityRoutes);
```

Add:
```javascript
const simulationRoutes = require('./modules/simulation/simulation.routes');
app.use('/api/admin/simulation', simulationRoutes);
```

- [ ] **Step 2: Start scheduler in index.js**

In `iroyinayo/src/index.js`, inside the `server.listen` callback, after the existing cron schedule setup, add:

```javascript
  try {
    const { startScheduler: startSimulation } = require('./modules/simulation/scheduler');
    startSimulation(io);
    console.log('Simulation scheduler started');
  } catch (err) {
    console.error('Simulation scheduler failed to start:', err.message);
  }
```

- [ ] **Step 3: Verify the server starts**

Run:
```bash
cd iroyinayo && node -e "require('./src/app')" 2>&1 | head -5
```
Expected: No syntax errors (connection errors are acceptable).

- [ ] **Step 4: Commit**

```bash
git add iroyinayo/src/app.js iroyinayo/src/index.js
git commit -m "feat(simulation): wire up simulation routes and scheduler to app startup"
```

---

### Task 9: Data Retention Cleanup Job

**Files:**
- Modify: `iroyinayo/src/modules/simulation/scheduler.js`

- [ ] **Step 1: Add cleanup cron**

At the end of the `startScheduler` function in `scheduler.js`, before the closing `}`, add:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add iroyinayo/src/modules/simulation/scheduler.js
git commit -m "feat(simulation): add daily purge of simulation records older than 30 days"
```

---

### Task 10: Integration Test

**Files:**
- Create: `iroyinayo/tests/simulation.test.js`

- [ ] **Step 1: Create the test file**

```javascript
const { runSimulation, generatePath, weightedRandom, computeResults } = require('../src/modules/simulation/engine');
const { shouldTrigger, reset } = require('../src/modules/simulation/triggers');

describe('Monte Carlo Engine', () => {
  describe('weightedRandom', () => {
    it('returns valid index for uniform weights', () => {
      const weights = [0.25, 0.25, 0.25, 0.25];
      for (let i = 0; i < 100; i++) {
        const idx = weightedRandom(weights);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(weights.length);
      }
    });

    it('handles zero weights', () => {
      const weights = [0, 0, 0];
      const idx = weightedRandom(weights);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    });

    it('strongly favors high-weight outcome', () => {
      const weights = [0.99, 0.005, 0.005];
      const counts = [0, 0, 0];
      for (let i = 0; i < 1000; i++) {
        counts[weightedRandom(weights)]++;
      }
      expect(counts[0]).toBeGreaterThan(900);
    });
  });

  describe('computeResults', () => {
    it('calculates mean probabilities and confidence intervals', () => {
      const outcomes = [
        { id: '1', label: 'Yes' },
        { id: '2', label: 'No' },
      ];
      const allFinalPrices = Array.from({ length: 100 }, () => [0.7, 0.3]);
      const { outcomes: results, confidenceScore } = computeResults(allFinalPrices, outcomes);

      expect(results[0].mean_prob).toBeCloseTo(0.7, 1);
      expect(results[1].mean_prob).toBeCloseTo(0.3, 1);
      expect(confidenceScore).toBeGreaterThan(0.5);
    });

    it('returns lower confidence for high variance', () => {
      const outcomes = [
        { id: '1', label: 'Yes' },
        { id: '2', label: 'No' },
      ];
      const allFinalPrices = Array.from({ length: 100 }, (_, i) =>
        i < 50 ? [0.9, 0.1] : [0.3, 0.7]
      );
      const { confidenceScore: highVariance } = computeResults(allFinalPrices, outcomes);

      const uniform = Array.from({ length: 100 }, () => [0.8, 0.2]);
      const { confidenceScore: lowVariance } = computeResults(uniform, outcomes);

      expect(lowVariance).toBeGreaterThan(highVariance);
    });
  });

  describe('generatePath', () => {
    it('returns valid probabilities that sum to ~1', () => {
      const sharesSold = [100, 100];
      const b = 50;
      const outcomes = [{ id: '1' }, { id: '2' }];
      const tradingProfile = { avgAmount: 10, volumePerStep: 1, directionalBias: [0.5, 0.5] };

      const result = generatePath(sharesSold, b, outcomes, 5, null, 0, tradingProfile);

      expect(result.length).toBe(2);
      const sum = result.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1, 1);
      result.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('Triggers', () => {
  beforeEach(() => reset());

  it('triggers on large price swing', () => {
    const result = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    expect(result).toBe(true);
  });

  it('does not trigger on small price swing', () => {
    const result = shouldTrigger('market-1', 'trade', { priceSwing: 0.05 });
    expect(result).toBe(false);
  });

  it('debounces repeated triggers', () => {
    const first = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    const second = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('triggers on volume spike', () => {
    for (let i = 0; i < 5; i++) {
      shouldTrigger('market-2', 'trade', { priceSwing: 0.01 });
    }
    reset();
    for (let i = 0; i < 5; i++) {
      const result = shouldTrigger('market-2', 'trade', { priceSwing: 0.01 });
      if (i === 4) expect(result).toBe(true);
    }
  });

  it('triggers on external data change', () => {
    const result = shouldTrigger('market-3', 'external_data_changed', {});
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd iroyinayo && npx jest tests/simulation.test.js --no-coverage 2>&1 | tail -20
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/tests/simulation.test.js
git commit -m "test(simulation): add unit tests for engine, triggers, and computeResults"
```

---
