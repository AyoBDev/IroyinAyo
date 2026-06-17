# Monte Carlo Market Simulation Engine

## Summary

An internal simulation engine that runs Monte Carlo forecasts on open markets, using trading patterns and external data to predict likely outcomes. It drives three platform functions: liquidity bot adjustments, market health alerts, and auto-resolution confidence flagging. Not user-facing.

## Core Simulation Logic

The engine runs N paths (default: 1000) per market, projecting how prices might evolve from current state until market close/resolution.

Each simulation path:
1. Starts at current LMSR prices (from `multi_market_outcomes.shares_sold` + market `liquidity_b`)
2. Applies random trades sampled from the market's historical trading patterns (volume per hour, average position size, directional bias per outcome)
3. Anchors toward external probabilities where available (e.g. The Odds API), with configurable anchor strength
4. Terminates at the market's close time (or 7 days forward if no close time set)

Output per simulation run:
- **Per-outcome probabilities**: mean simulated probability + 90% confidence interval
- **Confidence score** (0-1): how certain the simulation is about the leading outcome. Calculated as: `leadingMeanProb * (1 - (ci_high - ci_low))`. Example: if leading outcome has mean 0.85 with CI [0.78, 0.92], score = 0.85 * (1 - 0.14) = 0.73. A score of 0.95+ means the outcome is virtually certain across nearly all simulated paths.
- **Health flags**: boolean signals for stuck, manipulation, or external divergence

## Data Inputs

### Trading Pattern Inputs (from database)

| Signal | Source | Usage |
|--------|--------|-------|
| Trade volume per hour | `multi_market_positions.created_at` grouped by hour | Determines simulated trade frequency per path |
| Average position size | `multi_market_positions.amount` | Samples trade sizes from this distribution |
| Directional bias | Ratio of shares bought per outcome over last 24h | Biases random trade direction |
| Trader accuracy | `students` accuracy score for each trader | Weights recent trades from accurate users 2x |
| Price velocity | Delta of outcome prices over last 6 hours | Momentum factor in path generation |
| Time to close | `multi_markets.closes_at` minus now | Less simulated movement as close approaches |

### External Data Anchoring

Uses The Odds API (already integrated for the liquidity bot) as a probability anchor.

**Anchor strength tiers:**
- **Strong (80% external / 20% trading):** Direct match in Odds API (same event, same outcomes)
- **Moderate (50% / 50%):** Partial match (related event, approximate mapping)
- **None (100% trading):** No external data available (campus-specific markets). Simulation runs with wider confidence intervals.

The anchor works as a "gravity" force in path generation: at each step, there's a probability (proportional to anchor strength) that the path moves toward the external odds rather than following the random trading pattern.

## Triggers & Scheduling

### Periodic (Cron)

- **Every 30 minutes:** Batch-simulate all open markets
- **Every 10 minutes:** Markets within 2 hours of close (higher frequency for time-sensitive decisions)

### Event-Driven

Triggered when:
- A single trade moves an outcome's price by >10%
- Volume spike: 5+ trades on the same market within 5 minutes
- New external data arrives with odds that differ by >5% from current market prices
- A market enters its final 2 hours before close

**Debouncing:** If multiple events fire for the same market within 60 seconds, only one simulation runs. The most recent event's context is used.

## Actions & Decision Tiers

### Tier 1 — Automated (no approval)

**Liquidity correction:**
- Condition: Simulation shows market prices diverge from external data by >15%
- Action: Liquidity bot places corrective trades via existing `buyPosition` using the system account
- Constraint: Maximum correction of 5% price movement per 30-minute window to avoid disruption
- Uses existing liquidity bot infrastructure (system account, `buyPosition`)

**Data persistence:**
- Every simulation run writes results to `market_simulations` table
- Old runs are retained for 30 days, then purged

### Tier 2 — Flagged for Admin Review

**Manipulation alert (severity: high):**
- Condition: Single trader holds >60% of market volume AND simulation shows divergence from external data >20%
- Evidence stored: trader ID, position sizes, external odds comparison

**Stuck market alert (severity: medium):**
- Condition: No price movement in 48+ hours AND <3 unique traders
- Evidence stored: last trade timestamp, unique trader count, current prices

**Early resolution candidate (severity: low):**
- Condition: Simulation confidence score >0.95 (outcome virtually certain from external data + trading consensus)
- Evidence stored: confidence score, external odds, simulated probability distribution

### Alert Lifecycle

Alerts are written to `simulation_alerts` with status flow:
`pending` → `acknowledged` → `acted_on` | `dismissed`

Surfaced via:
- Admin API routes (existing admin dashboard)
- Optional WhatsApp notification to admin for high-severity alerts

## Database Schema

### market_simulations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| market_id | UUID | FK to multi_markets |
| run_at | timestamp | When simulation completed |
| trigger_type | enum('cron', 'event') | What initiated this run |
| paths_run | integer | Default 1000 |
| results | JSONB | `{ outcomes: [{ id, label, mean_prob, ci_low, ci_high }] }` |
| confidence_score | decimal(4,3) | 0.000 to 1.000 |
| external_anchor_used | boolean | Whether external data was available |
| external_odds | JSONB, nullable | `{ source, outcomes: [{ label, probability }] }` |

### simulation_alerts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| market_id | UUID | FK to multi_markets |
| simulation_id | UUID | FK to market_simulations |
| alert_type | enum('manipulation', 'stuck', 'early_resolution') | |
| severity | enum('low', 'medium', 'high') | |
| details | JSONB | Evidence and reasoning |
| status | enum('pending', 'acknowledged', 'acted_on', 'dismissed') | |
| created_at | timestamp | |
| resolved_at | timestamp, nullable | When admin acted on it |

## Module Structure

```
iroyinayo/src/modules/simulation/
├── index.js              — module initialization, attaches to Socket.io + cron
├── engine.js             — core Monte Carlo: runSimulation(market, config) → results
├── anchoring.js          — fetchExternalOdds(market), calculateAnchorStrength(market, externalOdds)
├── triggers.js           — event listeners (trade events), debounce logic
├── actions.js            — executeTier1Actions(simResult), createAlert(simResult, type)
├── scheduler.js          — cron jobs: batchSimulate(), nearCloseSimulate()
└── simulation.routes.js  — admin API: GET /alerts, PATCH /alerts/:id, GET /markets/:id/simulations
```

## Integration Points

- **Socket.io:** Listens to `prediction:placed` events (already broadcast) to detect volume spikes and large trades
- **Liquidity bot:** Actions module calls existing `buyPosition` with system account for corrections
- **Odds API:** Anchoring module reuses the adapter already built for the liquidity bot (`src/modules/markets/liquidity/`)
- **Admin dashboard:** New routes mounted under existing admin router
- **Cron:** Uses existing scheduler pattern (see `src/bot/scheduler/`)

## Configuration

Stored in `market_liquidity_config` table (existing) or environment variables:

| Parameter | Default | Description |
|-----------|---------|-------------|
| SIMULATION_PATHS | 1000 | Paths per run |
| SIMULATION_INTERVAL_MINUTES | 30 | Cron frequency |
| NEAR_CLOSE_INTERVAL_MINUTES | 10 | Frequency for markets near close |
| NEAR_CLOSE_THRESHOLD_HOURS | 2 | When to switch to higher frequency |
| DIVERGENCE_THRESHOLD | 0.15 | Price divergence to trigger correction |
| MAX_CORRECTION_PER_WINDOW | 0.05 | Max price movement from corrections per 30min |
| CONFIDENCE_THRESHOLD | 0.95 | Score needed to flag early resolution |
| MANIPULATION_VOLUME_THRESHOLD | 0.60 | Single trader volume % to flag |
| STUCK_HOURS_THRESHOLD | 48 | Hours without movement to flag |
| DEBOUNCE_MS | 60000 | Event debounce window |
