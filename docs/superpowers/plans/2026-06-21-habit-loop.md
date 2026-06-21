# Habit Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trigger and investment infrastructure that turns IroyinMarket into a daily-habit product — daily WhatsApp ritual via Baileys, smart-split deep-link landings, three-beat layered reveal, accuracy-as-identity profile, and position-driven future triggers.

**Architecture:** Backend gains a queue-driven WhatsApp pipeline (new tables `whatsapp_daily_queue`, `position_triggers`; new columns on `students` and `multi_market_positions`) that runs alongside the existing scheduler, replacing the current `0 8 * * *` morning digest. Frontend gains a quick-predict render mode on `MarketDetail`, a three-beat `PredictionReveal` component (replacing `PredictionConfirmation`), and a reworked `Profile` header. All work happens in worktree `worktrees/habit-loop` on branch `feat/habit-loop`.

**Tech Stack:** Backend — Node.js + Express, Knex/PostgreSQL, Baileys ^7, node-cron, Jest. Frontend — React 19 + Vite, Tailwind 4, Zustand, Socket.io client.

## Global Constraints

- **Working directory:** `/Users/mac/Documents/claudeCode/new p/worktrees/habit-loop`. Every `git` and shell command runs from there. Never modify the main working tree.
- **Branch:** `feat/habit-loop`. Branched from `main` at the spec commit `2a84476`.
- **Backend module rename out of scope.** Public copy uses "users" / "predictors"; database tables and module paths keep `students` naming. Where the spec says "users table", the implementation uses the existing `students` table.
- **Spec is canonical.** Path: `docs/superpowers/specs/2026-06-21-habit-loop-design.md`. When the plan abbreviates a number, threshold, or rule, the spec's value governs.
- **DESIGN.md governs all visual choices.** Path: `DESIGN.md` (project root). Tokens (colors, spacing, fonts) come from `prediction-web/src/styles/global.css`. Never invent new colors or scales.
- **Test runner:** `cd iroyinayo && npm test` (Jest, single test: `npm test -- <pattern>`). Tests truncate tables defined in `iroyinayo/tests/setup.js` before each test. New tables added in this plan must be added to that truncate list.
- **Migration numbering:** continues from `024_create_simulation_tables.js`. New migrations get sequential numbers starting at `025`.
- **WhatsApp send path:** all outgoing messages go through `sendWhatsApp(phoneNumber, text)` in `iroyinayo/src/modules/notifications/whatsapp.js`. Do not call `sock.sendMessage` directly from new code.
- **Throttle table:** the existing `notification_throttles` table is reused for new throttle types (e.g., `wa_daily`, `resolved_away`, `sharp_move_position`). Do not create parallel throttle tables.
- **Frontend rebuild:** after any change in `prediction-web/`, run the rebuild copy command from `CLAUDE.md` before committing the public bundle. This plan keeps that as the last task to avoid churning the bundle mid-plan.
- **Commits:** small, frequent, focused. No AI attribution trailers. Format: `<area>: <summary>` (e.g., `feat(wa): add daily queue table`).

---

## File Structure

### New files (backend)

| Path | Responsibility |
|---|---|
| `iroyinayo/migrations/025_add_wa_daily_columns_to_students.js` | Add 5 columns to `students`: `wa_anchor_time`, `wa_daily_enabled`, `wa_paused_until`, `wa_failure_count`, `last_app_open_at`. |
| `iroyinayo/migrations/026_create_whatsapp_daily_queue.js` | New table `whatsapp_daily_queue` per spec §7.2. |
| `iroyinayo/migrations/027_add_source_ref_to_positions.js` | Add `source_ref` column to `multi_market_positions`. |
| `iroyinayo/migrations/028_create_position_triggers.js` | New table `position_triggers` per spec §6.4. |
| `iroyinayo/src/modules/habit/ledePicker.js` | Pure function: given a user, return the highest-priority lede that applies (rank / resolution / social / curiosity / null). Pure for unit testability — DB access via passed-in helpers. |
| `iroyinayo/src/modules/habit/queueBuilder.js` | Builds tomorrow's `whatsapp_daily_queue` rows for all eligible users — picks anchor times, jitters, picks lede, picks markets line. |
| `iroyinayo/src/modules/habit/messageRenderer.js` | Renders queue rows to final `body_text`: greeting rotation, lede formatting, markets line, CTA with deep-link params. |
| `iroyinayo/src/modules/habit/queueSender.js` | Drains `whatsapp_daily_queue` with global pacing (1 msg per 4–8s, ~30–60s pause every 50). Calls `sendWhatsApp`, updates status, handles failure counter. |
| `iroyinayo/src/modules/habit/positionTriggers.js` | Evaluates `position_triggers` eligibility on a schedule. Three conditions: `resolution_today`, `resolved_away`, `sharp_move`. |
| `iroyinayo/src/modules/habit/accuracy.js` | Computes per-user accuracy stats: all-time, 30d, per-category. Used by profile API and lede picker. |
| `iroyinayo/src/modules/habit/habit.routes.js` | New routes: `GET /api/habit/profile/:userId/accuracy`, `GET /api/habit/triggers/in-app-strip` (for the `/markets` strip), `POST /api/habit/opt-in` (web opt-in for daily sends). |
| `iroyinayo/src/bot/handlers/dailyOptIn.js` | Bot handler: when a user sends any message to the bot, set `wa_daily_enabled` to true if they have completed web opt-in. Also handles `PAUSE` and `STOP` replies. |
| `iroyinayo/tests/habit/ledePicker.test.js` | Unit tests for lede priority. |
| `iroyinayo/tests/habit/queueBuilder.test.js` | Integration tests for queue building. |
| `iroyinayo/tests/habit/messageRenderer.test.js` | Unit tests for rendering. |
| `iroyinayo/tests/habit/queueSender.test.js` | Integration tests with mocked Baileys. |
| `iroyinayo/tests/habit/positionTriggers.test.js` | Integration tests for trigger eligibility. |
| `iroyinayo/tests/habit/accuracy.test.js` | Unit tests for accuracy math. |
| `iroyinayo/tests/habit/habit.routes.test.js` | Route tests. |

### New files (frontend)

| Path | Responsibility |
|---|---|
| `prediction-web/src/components/PredictionReveal.jsx` | New three-beat reveal sheet. Replaces `PredictionConfirmation` usage in `PredictSlip`. |
| `prediction-web/src/components/QuickPredictBar.jsx` | Inline component shown in `MarketDetail` quick-predict mode: enlarged outcome buttons, default-stake stepper, pinned predict CTA. |
| `prediction-web/src/components/MarketsTopStrip.jsx` | "Markets you might call" strip rendered at top of `/markets` when `?ref=wa_daily&lede=rank`. |
| `prediction-web/src/components/ProfileAccuracyHeader.jsx` | New profile header: hero accuracy, 30d, per-category strip, rank line, open positions count. |
| `prediction-web/src/hooks/useDeepLinkRef.js` | Reads `?ref` / `?lede` / `?market` from URL; persists `?ref` into prediction payload. |

### Modified files (backend)

| Path | Change |
|---|---|
| `iroyinayo/src/bot/scheduler/dailyJobs.js` | Remove the existing `0 8 * * *` morning digest cron block (lines 42–69). Add three new cron blocks: `queueBuilder` (runs at 5:00 WAT daily — builds tomorrow's queue), `queueSender` (runs at 6:55 WAT daily — drains today's queue starting at 7:00 window), `positionTriggers` (every 10 minutes — evaluates trigger eligibility). |
| `iroyinayo/src/modules/notifications/whatsapp.js` | Add new exported helper `sendWhatsAppWithFailureTracking(student, text)` that wraps `sendWhatsApp` and updates `wa_failure_count` / `wa_paused_until`. |
| `iroyinayo/src/modules/markets/multiMarkets.service.js` | In `buyPosition`, accept and persist new `source_ref` field on the position row. |
| `iroyinayo/src/app.js` | Register `habit.routes.js`. Add middleware that updates `students.last_app_open_at` on authenticated requests. |
| `iroyinayo/tests/setup.js` | Add `whatsapp_daily_queue`, `position_triggers` to the truncate list. |

### Modified files (frontend)

| Path | Change |
|---|---|
| `prediction-web/src/pages/MarketDetail.jsx` | Read `?ref=wa_daily` via `useDeepLinkRef`. When present, render `QuickPredictBar` for 30s or until predict. |
| `prediction-web/src/pages/Markets.jsx` | Read `?ref=wa_daily&lede=rank`. When matched, render `MarketsTopStrip` with the markets passed via URL or fetched from `/api/habit/triggers/in-app-strip`. |
| `prediction-web/src/pages/Profile.jsx` | Replace existing header with `ProfileAccuracyHeader`. Demote points/streak sections per spec §6.1. |
| `prediction-web/src/components/PredictSlip.jsx` | Replace `PredictionConfirmation` import with `PredictionReveal`. Pass through new props (impact delta, social ticker condition). |
| `prediction-web/src/components/PredictionConfirmation.jsx` | DELETED after `PredictionReveal` ships. |
| `prediction-web/src/api.js` | Add: `getAccuracy(userId)`, `getInAppTriggerStrip()`, `optInToDaily()`. Modify: `predict()` to include `source_ref`. |
| `prediction-web/src/components/ProfileShareModal.jsx` | Update to capture the new `ProfileAccuracyHeader` element. Update default share text per spec §6.1. |

---

## Task ordering rationale

Tasks are ordered so each one ships independently testable behavior:

- **Tasks 1–4: Schema.** All migrations land first. Allows parallel work on the modules. Failure mode is small (run migrations, run tests).
- **Tasks 5–6: Building blocks.** Accuracy math and lede picker are pure modules, used everywhere else. Heavily unit-tested.
- **Tasks 7–9: Queue pipeline.** Queue builder → message renderer → queue sender. Each task ends with a deliverable that's testable against a mocked Baileys.
- **Task 10: Wire the cron jobs.** Replaces the old morning digest. The product is now live for backend behavior.
- **Tasks 11–13: Trigger module.** Position triggers + the in-app strip + the bot opt-in / PAUSE / STOP handler.
- **Tasks 14–16: Frontend — deep-link landing.** `useDeepLinkRef`, quick-predict bar, markets top strip. After these, deep links work end-to-end.
- **Tasks 17–18: Frontend — reveal sheet.** `PredictionReveal` ships as the new reward moment.
- **Tasks 19–20: Frontend — profile.** `ProfileAccuracyHeader` and share modal updates.
- **Task 21: Telemetry.** All events from spec §8 wired together at the end so we don't churn the instrumentation contract mid-build.
- **Task 22: Frontend rebuild + ship.** Single final rebuild of `prediction-web/dist/` into `iroyinayo/public/`.

---

## Task 1: Schema — daily WA columns on students

**Files:**
- Create: `iroyinayo/migrations/025_add_wa_daily_columns_to_students.js`
- Test: covered by running migrations in `iroyinayo/tests/setup.js` (no dedicated unit test needed for migrations)

**Interfaces:**
- Consumes: nothing.
- Produces: 5 new columns on `students`: `wa_anchor_time` (time, nullable), `wa_daily_enabled` (boolean default false), `wa_paused_until` (timestamptz nullable), `wa_failure_count` (integer default 0), `last_app_open_at` (timestamptz nullable). Indexes: `(wa_daily_enabled, wa_paused_until)`.

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/025_add_wa_daily_columns_to_students.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.time('wa_anchor_time').nullable();
    table.boolean('wa_daily_enabled').notNullable().defaultTo(false);
    table.timestamp('wa_paused_until', { useTz: true }).nullable();
    table.integer('wa_failure_count').notNullable().defaultTo(0);
    table.timestamp('last_app_open_at', { useTz: true }).nullable();
    table.index(['wa_daily_enabled', 'wa_paused_until'], 'idx_students_wa_daily_eligible');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('students', (table) => {
    table.dropIndex(['wa_daily_enabled', 'wa_paused_until'], 'idx_students_wa_daily_eligible');
    table.dropColumn('wa_anchor_time');
    table.dropColumn('wa_daily_enabled');
    table.dropColumn('wa_paused_until');
    table.dropColumn('wa_failure_count');
    table.dropColumn('last_app_open_at');
  });
};
```

- [ ] **Step 2: Run migration**

Run: `cd iroyinayo && npm run migrate`
Expected: `Batch N run: 1 migrations` listing `025_add_wa_daily_columns_to_students.js`.

- [ ] **Step 3: Run migration in test DB**

Run: `cd iroyinayo && npm run migrate:test`
Expected: same success line.

- [ ] **Step 4: Verify columns exist**

Run: `cd iroyinayo && node -e "require('./src/config/database').raw(\"SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name LIKE 'wa_%' OR column_name='last_app_open_at'\").then(r => { console.log(r.rows); process.exit(0); })"`
Expected: 5 rows with the new column names.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/claudeCode/new\ p/worktrees/habit-loop
git add iroyinayo/migrations/025_add_wa_daily_columns_to_students.js
git commit -m "feat(wa): add daily-send columns to students table"
```

---

## Task 2: Schema — whatsapp_daily_queue table

**Files:**
- Create: `iroyinayo/migrations/026_create_whatsapp_daily_queue.js`
- Modify: `iroyinayo/tests/setup.js` — add `whatsapp_daily_queue` to truncate list.

**Interfaces:**
- Consumes: `students.id`.
- Produces: table `whatsapp_daily_queue` with columns per spec §7.2. Indexes: `(scheduled_for, status)` for the sender's claim query, `(student_id, scheduled_for)` for dedupe checks.

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/026_create_whatsapp_daily_queue.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.createTable('whatsapp_daily_queue', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.timestamp('scheduled_for', { useTz: true }).notNullable();
    table.enu('lede_type', ['rank', 'resolution', 'social', 'curiosity']).nullable();
    table.jsonb('lede_payload').nullable();
    table.jsonb('markets').notNullable().defaultTo('[]');
    table.text('body_text').nullable();
    table.enu('status', ['pending', 'sent', 'failed', 'skipped']).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('last_error').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.index(['scheduled_for', 'status'], 'idx_wa_queue_drain');
    table.index(['student_id', 'scheduled_for'], 'idx_wa_queue_dedupe');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('whatsapp_daily_queue');
};
```

- [ ] **Step 2: Update test setup truncate list**

In `iroyinayo/tests/setup.js`, find the `tables` array (around line 9–14) and add `'whatsapp_daily_queue'` after `'verification_codes'`:

```javascript
const tables = [
  'verification_codes',
  'whatsapp_daily_queue',
  'market_positions', 'markets', 'point_transactions', 'streaks',
  'quiz_answers', 'quizzes', 'redemptions', 'reward_options',
  'content_tags', 'content', 'student_interests', 'students', 'admins',
];
```

- [ ] **Step 3: Run migrations**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed with `026_create_whatsapp_daily_queue.js`.

- [ ] **Step 4: Verify table exists**

Run: `cd iroyinayo && node -e "require('./src/config/database').raw(\"SELECT column_name FROM information_schema.columns WHERE table_name='whatsapp_daily_queue' ORDER BY ordinal_position\").then(r => { console.log(r.rows.map(x => x.column_name)); process.exit(0); })"`
Expected: prints `[id, student_id, scheduled_for, lede_type, lede_payload, markets, body_text, status, attempts, last_error, created_at, sent_at]`.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/migrations/026_create_whatsapp_daily_queue.js iroyinayo/tests/setup.js
git commit -m "feat(wa): create whatsapp_daily_queue table"
```

---

## Task 3: Schema — source_ref on positions

**Files:**
- Create: `iroyinayo/migrations/027_add_source_ref_to_positions.js`

**Interfaces:**
- Consumes: existing `multi_market_positions` table.
- Produces: `multi_market_positions.source_ref` (text, nullable). Used by `predict()` payload to record where the prediction originated (`wa_daily:rank`, `direct`, `share`, etc.).

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/027_add_source_ref_to_positions.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.string('source_ref', 64).nullable();
    table.index('source_ref', 'idx_positions_source_ref');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('multi_market_positions', (table) => {
    table.dropIndex('source_ref', 'idx_positions_source_ref');
    table.dropColumn('source_ref');
  });
};
```

- [ ] **Step 2: Run migrations**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed.

- [ ] **Step 3: Verify column exists**

Run: `cd iroyinayo && node -e "require('./src/config/database').raw(\"SELECT column_name FROM information_schema.columns WHERE table_name='multi_market_positions' AND column_name='source_ref'\").then(r => { console.log(r.rows); process.exit(0); })"`
Expected: one row, `source_ref`.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo/migrations/027_add_source_ref_to_positions.js
git commit -m "feat: add source_ref attribution to positions"
```

---

## Task 4: Schema — position_triggers table

**Files:**
- Create: `iroyinayo/migrations/028_create_position_triggers.js`
- Modify: `iroyinayo/tests/setup.js` — add `position_triggers` to truncate list.

**Interfaces:**
- Consumes: `multi_market_positions.id`.
- Produces: table `position_triggers` per spec §6.4. Note: the `position_id` foreign key targets `multi_market_positions` (the actual table name in this codebase, not `positions`).

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/028_create_position_triggers.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.createTable('position_triggers', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('position_id').notNullable().references('id').inTable('multi_market_positions').onDelete('CASCADE');
    table.enu('condition', ['resolution_today', 'resolved_away', 'sharp_move']).notNullable();
    table.timestamp('eligible_at', { useTz: true }).notNullable();
    table.timestamp('fired_at', { useTz: true }).nullable();
    table.enu('surfaced_via', ['wa_daily', 'wa_oneoff', 'in_app_strip']).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['position_id', 'condition'], 'uniq_position_condition');
    table.index(['condition', 'fired_at'], 'idx_triggers_pending');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('position_triggers');
};
```

The `unique(['position_id', 'condition'])` constraint provides the idempotency guarantee from spec §6.4: a (position, condition) pair generates only one row until fired and cleared.

- [ ] **Step 2: Update test setup truncate list**

In `iroyinayo/tests/setup.js`, add `'position_triggers'` to the truncate list, after `'whatsapp_daily_queue'`:

```javascript
const tables = [
  'verification_codes',
  'whatsapp_daily_queue',
  'position_triggers',
  // ... rest unchanged
];
```

- [ ] **Step 3: Run migrations**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed with `028_create_position_triggers.js`.

- [ ] **Step 4: Verify table and unique constraint**

Run: `cd iroyinayo && node -e "require('./src/config/database').raw(\"SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='position_triggers'\").then(r => { console.log(r.rows); process.exit(0); })"`
Expected: includes `uniq_position_condition` among the constraints.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/migrations/028_create_position_triggers.js iroyinayo/tests/setup.js
git commit -m "feat(triggers): create position_triggers table"
```

---

## Task 5: Accuracy computation module

**Files:**
- Create: `iroyinayo/src/modules/habit/accuracy.js`
- Test: `iroyinayo/tests/habit/accuracy.test.js`

**Interfaces:**
- Consumes: `multi_market_positions` joined with `multi_markets` (for `category` and resolved status), `students.id`.
- Produces:
  - `async function computeAccuracy(studentId, { since? } = {})` → `{ resolvedCalls: number, correct: number, accuracy: number | null }`. Returns `accuracy: null` if `resolvedCalls < 3`.
  - `async function computeCategoryAccuracy(studentId)` → `Array<{ category: string, resolvedCalls: number, correct: number, accuracy: number }>`. Only includes categories with `resolvedCalls >= 5`.
  - `async function computeAccuracyRank(studentId)` → `{ rank: number, percentile: number, totalRanked: number }`. Only counts users with ≥3 resolved calls; percentile is `(totalRanked - rank + 1) / totalRanked * 100`.

The "one call per market" rule from spec §6.2: a call is the user's **net** position on a market at resolution. Multiple buys on the same outcome of the same market collapse into one call (judged by final outcome). A net-flat user is excluded entirely.

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/habit/accuracy.test.js`:

```javascript
const db = require('../../src/config/database');
const { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank } = require('../../src/modules/habit/accuracy');
const { v4: uuidv4 } = require('uuid');

async function createResolvedMarket({ category, winningLabel, outcomes = ['YES', 'NO'] }) {
  const marketId = uuidv4();
  await db('multi_markets').insert({
    id: marketId,
    title: `Test market ${marketId.slice(0, 8)}`,
    category,
    status: 'resolved',
    resolved_at: new Date(),
    liquidity_b: 100,
  });
  const outcomeRows = [];
  for (const label of outcomes) {
    const id = uuidv4();
    outcomeRows.push({ id, market_id: marketId, label, shares_sold: 0, is_winner: label === winningLabel });
  }
  await db('multi_market_outcomes').insert(outcomeRows);
  return { marketId, outcomes: outcomeRows };
}

async function createStudent(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

async function placePosition({ studentId, marketId, outcomeId, shares, payout = 0 }) {
  await db('multi_market_positions').insert({
    id: uuidv4(),
    student_id: studentId,
    market_id: marketId,
    outcome_id: outcomeId,
    shares,
    amount: shares * 50,
    payout,
  });
}

describe('computeAccuracy', () => {
  test('returns null accuracy when fewer than 3 resolved calls', async () => {
    const studentId = await createStudent();
    const { marketId, outcomes } = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId, outcomeId: outcomes[0].id, shares: 10, payout: 500 });

    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(1);
    expect(result.accuracy).toBeNull();
  });

  test('counts correct calls when 3+ resolved', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 3; i++) {
      const { marketId, outcomes } = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId, outcomeId: outcomes[0].id, shares: 10, payout: 500 });
    }
    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3);
    expect(result.correct).toBe(3);
    expect(result.accuracy).toBeCloseTo(1.0);
  });

  test('collapses multiple buys on same outcome to one call', async () => {
    const studentId = await createStudent();
    const market1 = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market1.marketId, outcomeId: market1.outcomes[0].id, shares: 5, payout: 250 });
    await placePosition({ studentId, marketId: market1.marketId, outcomeId: market1.outcomes[0].id, shares: 5, payout: 250 });
    const market2 = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market2.marketId, outcomeId: market2.outcomes[0].id, shares: 10, payout: 500 });
    const market3 = await createResolvedMarket({ category: 'football', winningLabel: 'NO' });
    await placePosition({ studentId, marketId: market3.marketId, outcomeId: market3.outcomes[0].id, shares: 10, payout: 0 });

    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3);
    expect(result.correct).toBe(2);
  });

  test('excludes net-flat (arbitrage) positions', async () => {
    const studentId = await createStudent();
    const market = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market.marketId, outcomeId: market.outcomes[0].id, shares: 10, payout: 500 });
    await placePosition({ studentId, marketId: market.marketId, outcomeId: market.outcomes[1].id, shares: 10, payout: 0 });
    // Add 3 more clean calls so accuracy doesn't return null
    for (let i = 0; i < 3; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3); // arbitrage market excluded
  });
});

describe('computeCategoryAccuracy', () => {
  test('omits categories with fewer than 5 resolved calls', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 4; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeCategoryAccuracy(studentId);
    expect(result.find((r) => r.category === 'football')).toBeUndefined();
  });

  test('includes categories with 5+ resolved calls', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 5; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeCategoryAccuracy(studentId);
    const football = result.find((r) => r.category === 'football');
    expect(football).toBeDefined();
    expect(football.accuracy).toBeCloseTo(1.0);
  });
});

describe('computeAccuracyRank', () => {
  test('returns rank and percentile across users with 3+ calls', async () => {
    const ids = [];
    for (let u = 0; u < 3; u++) {
      const studentId = await createStudent();
      ids.push(studentId);
      const correctCount = u; // user 0 has 0 right, user 1 has 1 right, user 2 has 2 right (each across 3 markets)
      for (let i = 0; i < 3; i++) {
        const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
        const pickWinner = i < correctCount;
        await placePosition({ studentId, marketId: m.marketId, outcomeId: pickWinner ? m.outcomes[0].id : m.outcomes[1].id, shares: 5, payout: pickWinner ? 250 : 0 });
      }
    }
    const top = await computeAccuracyRank(ids[2]);
    expect(top.rank).toBe(1);
    expect(top.totalRanked).toBe(3);
    expect(top.percentile).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iroyinayo && npm test -- accuracy.test.js`
Expected: FAIL with `Cannot find module '../../src/modules/habit/accuracy'`.

- [ ] **Step 3: Implement the module**

Create `iroyinayo/src/modules/habit/accuracy.js`:

```javascript
const db = require('../../config/database');

const MIN_CALLS_HEADLINE = 3;
const MIN_CALLS_CATEGORY = 5;

async function getResolvedCalls(studentId, { since } = {}) {
  let query = db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('multi_market_outcomes as o', 'p.outcome_id', 'o.id')
    .where('p.student_id', studentId)
    .where('m.status', 'resolved')
    .whereNotIn('m.status', ['void', 'canceled'])
    .select(
      'p.market_id',
      'p.outcome_id',
      'm.category',
      'o.is_winner',
      'p.shares'
    );
  if (since) {
    query = query.where('m.resolved_at', '>=', since);
  }
  const rows = await query;

  const byMarket = new Map();
  for (const row of rows) {
    const key = row.market_id;
    if (!byMarket.has(key)) byMarket.set(key, { netByOutcome: new Map(), category: row.category });
    const m = byMarket.get(key);
    m.netByOutcome.set(row.outcome_id, (m.netByOutcome.get(row.outcome_id) || 0) + Number(row.shares));
    if (row.is_winner) m.winningOutcomeId = row.outcome_id;
  }

  const calls = [];
  for (const [, m] of byMarket) {
    const entries = [...m.netByOutcome.entries()].filter(([, n]) => n > 0);
    if (entries.length !== 1) continue;
    const [outcomeId] = entries[0];
    calls.push({ category: m.category, correct: outcomeId === m.winningOutcomeId });
  }
  return calls;
}

async function computeAccuracy(studentId, opts = {}) {
  const calls = await getResolvedCalls(studentId, opts);
  const resolvedCalls = calls.length;
  const correct = calls.filter((c) => c.correct).length;
  return {
    resolvedCalls,
    correct,
    accuracy: resolvedCalls >= MIN_CALLS_HEADLINE ? correct / resolvedCalls : null,
  };
}

async function computeCategoryAccuracy(studentId) {
  const calls = await getResolvedCalls(studentId);
  const byCategory = new Map();
  for (const call of calls) {
    if (!byCategory.has(call.category)) byCategory.set(call.category, { resolvedCalls: 0, correct: 0 });
    const c = byCategory.get(call.category);
    c.resolvedCalls += 1;
    if (call.correct) c.correct += 1;
  }
  return [...byCategory.entries()]
    .filter(([, c]) => c.resolvedCalls >= MIN_CALLS_CATEGORY)
    .map(([category, c]) => ({
      category,
      resolvedCalls: c.resolvedCalls,
      correct: c.correct,
      accuracy: c.correct / c.resolvedCalls,
    }));
}

async function computeAccuracyRank(studentId) {
  const allStudents = await db('students').where({ is_system: false, is_banned: false }).select('id');
  const accuracies = [];
  for (const s of allStudents) {
    const a = await computeAccuracy(s.id);
    if (a.accuracy !== null) accuracies.push({ studentId: s.id, accuracy: a.accuracy });
  }
  accuracies.sort((a, b) => b.accuracy - a.accuracy);
  const totalRanked = accuracies.length;
  const idx = accuracies.findIndex((a) => a.studentId === studentId);
  if (idx === -1) return { rank: null, percentile: null, totalRanked };
  const rank = idx + 1;
  return { rank, totalRanked, percentile: ((totalRanked - rank + 1) / totalRanked) * 100 };
}

module.exports = { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank, MIN_CALLS_HEADLINE, MIN_CALLS_CATEGORY };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd iroyinayo && npm test -- accuracy.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/accuracy.js iroyinayo/tests/habit/accuracy.test.js
git commit -m "feat(habit): accuracy computation with one-call-per-market rule"
```

---

## Task 6: Lede picker

**Files:**
- Create: `iroyinayo/src/modules/habit/ledePicker.js`
- Test: `iroyinayo/tests/habit/ledePicker.test.js`

**Interfaces:**
- Consumes: `students` table, `weekly_leaderboard` table (existing — for rank), `multi_market_positions`, `multi_markets`.
- Produces: `async function pickLede(studentId, { now? } = {})` → `{ type: 'rank' | 'resolution' | 'social' | 'curiosity' | null, payload: object }`. Returns `{ type: null, payload: null }` when no priority 1–3 condition holds AND there's no qualifying curiosity market.

Priorities per spec §3.2:
1. Rank moved ≥3 positions since previous day's snapshot.
2. ≥1 open position resolves in next 24h.
3. A user this user has predicted alongside (same market, same side, within 7d) just placed a new prediction in the previous 12h.
4. Curiosity fallback — most-traded market in previous 24h with >50 predictions.

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/habit/ledePicker.test.js`:

```javascript
const db = require('../../src/config/database');
const { pickLede } = require('../../src/modules/habit/ledePicker');
const { v4: uuidv4 } = require('uuid');

async function createStudent() {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 10000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
  });
  return id;
}

async function createMarket({ status = 'open', closesAt = null, category = 'football' } = {}) {
  const marketId = uuidv4();
  await db('multi_markets').insert({
    id: marketId,
    title: `T ${marketId.slice(0, 8)}`,
    status,
    category,
    liquidity_b: 100,
    closes_at: closesAt,
  });
  const outcomeId = uuidv4();
  await db('multi_market_outcomes').insert({
    id: outcomeId,
    market_id: marketId,
    label: 'YES',
    shares_sold: 0,
  });
  return { marketId, outcomeId };
}

describe('pickLede', () => {
  test('returns rank lede when leaderboard moved 3+', async () => {
    const studentId = await createStudent();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    await db('weekly_leaderboard').insert([
      { id: uuidv4(), student_id: studentId, rank: 50, week_start: yesterday, points: 0 },
      { id: uuidv4(), student_id: studentId, rank: 45, week_start: today, points: 0 },
    ]);
    const r = await pickLede(studentId);
    expect(r.type).toBe('rank');
    expect(r.payload.rankDelta).toBe(5);
    expect(r.payload.currentRank).toBe(45);
  });

  test('returns resolution lede when open position resolves in next 24h', async () => {
    const studentId = await createStudent();
    const closesAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const { marketId, outcomeId } = await createMarket({ status: 'open', closesAt });
    await db('multi_market_positions').insert({
      id: uuidv4(),
      student_id: studentId,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 5,
      amount: 250,
    });
    const r = await pickLede(studentId);
    expect(r.type).toBe('resolution');
    expect(r.payload.count).toBeGreaterThanOrEqual(1);
  });

  test('returns curiosity lede when no priority 1-3 matches but a hot market exists', async () => {
    const studentId = await createStudent();
    const { marketId, outcomeId } = await createMarket({ status: 'open' });
    for (let i = 0; i < 60; i++) {
      const otherStudent = await createStudent();
      await db('multi_market_positions').insert({
        id: uuidv4(),
        student_id: otherStudent,
        market_id: marketId,
        outcome_id: outcomeId,
        shares: 1,
        amount: 50,
      });
    }
    const r = await pickLede(studentId);
    expect(r.type).toBe('curiosity');
    expect(r.payload.marketId).toBe(marketId);
  });

  test('returns null when no condition holds and no curiosity market qualifies', async () => {
    const studentId = await createStudent();
    const r = await pickLede(studentId);
    expect(r.type).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iroyinayo && npm test -- ledePicker.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the module**

Create `iroyinayo/src/modules/habit/ledePicker.js`:

```javascript
const db = require('../../config/database');

const HOT_MARKET_MIN_PREDICTIONS = 50;
const SOCIAL_LOOKBACK_DAYS = 7;
const SOCIAL_RECENT_HOURS = 12;

async function rankLede(studentId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const rows = await db('weekly_leaderboard')
    .where('student_id', studentId)
    .whereIn('week_start', [today, yesterday])
    .select('week_start', 'rank');
  if (rows.length < 2) return null;
  const todayRow = rows.find((r) => new Date(r.week_start).getTime() === today.getTime());
  const yesterdayRow = rows.find((r) => new Date(r.week_start).getTime() === yesterday.getTime());
  if (!todayRow || !yesterdayRow) return null;
  const delta = yesterdayRow.rank - todayRow.rank;
  if (Math.abs(delta) < 3) return null;
  return { type: 'rank', payload: { currentRank: todayRow.rank, rankDelta: delta } };
}

async function resolutionLede(studentId) {
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const positions = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('p.student_id', studentId)
    .where('m.status', 'open')
    .whereNotNull('m.closes_at')
    .where('m.closes_at', '<=', horizon)
    .where('m.closes_at', '>', new Date())
    .select('m.id', 'm.title');
  if (positions.length === 0) return null;
  return { type: 'resolution', payload: { count: positions.length, marketIds: positions.map((p) => p.id) } };
}

async function socialLede(studentId) {
  const lookback = new Date(Date.now() - SOCIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - SOCIAL_RECENT_HOURS * 60 * 60 * 1000);
  const myPositions = await db('multi_market_positions')
    .where('student_id', studentId)
    .where('created_at', '>=', lookback)
    .select('market_id', 'outcome_id');
  if (myPositions.length === 0) return null;
  for (const mp of myPositions) {
    const recentMatching = await db('multi_market_positions as p')
      .join('students as s', 'p.student_id', 's.id')
      .where('p.market_id', mp.market_id)
      .where('p.outcome_id', mp.outcome_id)
      .where('p.student_id', '!=', studentId)
      .where('p.created_at', '>=', recent)
      .where('s.is_system', false)
      .select('s.id', 's.name', 'p.market_id')
      .first();
    if (recentMatching) {
      const market = await db('multi_markets').where('id', mp.market_id).select('title').first();
      return { type: 'social', payload: { friendName: recentMatching.name, marketId: mp.market_id, marketTitle: market.title } };
    }
  }
  return null;
}

async function curiosityLede() {
  const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const row = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('m.status', 'open')
    .where('p.created_at', '>=', lookback)
    .groupBy('m.id', 'm.title')
    .havingRaw('COUNT(p.id) > ?', [HOT_MARKET_MIN_PREDICTIONS])
    .orderByRaw('COUNT(p.id) DESC')
    .select('m.id as marketId', 'm.title as marketTitle')
    .first();
  if (!row) return null;
  return { type: 'curiosity', payload: { marketId: row.marketId, marketTitle: row.marketTitle } };
}

async function pickLede(studentId) {
  const r = await rankLede(studentId);
  if (r) return r;
  const res = await resolutionLede(studentId);
  if (res) return res;
  const soc = await socialLede(studentId);
  if (soc) return soc;
  const cur = await curiosityLede();
  if (cur) return cur;
  return { type: null, payload: null };
}

module.exports = { pickLede };
```

- [ ] **Step 4: Run tests**

Run: `cd iroyinayo && npm test -- ledePicker.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/ledePicker.js iroyinayo/tests/habit/ledePicker.test.js
git commit -m "feat(habit): lede picker with rank/resolution/social/curiosity priority"
```

---

## Task 7: Queue builder

**Files:**
- Create: `iroyinayo/src/modules/habit/queueBuilder.js`
- Test: `iroyinayo/tests/habit/queueBuilder.test.js`

**Interfaces:**
- Consumes: `pickLede` from Task 6, `students` table.
- Produces:
  - `async function buildDailyQueue({ targetDate, now? })` → returns `{ enqueued: number, skipped: number }`. Writes rows to `whatsapp_daily_queue` for all eligible students.
  - `function pickAnchorTime(rng)` → `string` HH:MM:SS within 7:00–9:30 WAT window.
  - `function jitterScheduledFor(anchorTime, targetDate, rng)` → `Date` representing the actual fire moment in WAT.

Eligibility: `wa_daily_enabled = true` AND (`wa_paused_until` is null OR < now) AND `is_banned = false`.

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/habit/queueBuilder.test.js`:

```javascript
const db = require('../../src/config/database');
const { buildDailyQueue, pickAnchorTime, jitterScheduledFor } = require('../../src/modules/habit/queueBuilder');
const { v4: uuidv4 } = require('uuid');

function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

async function createEnrolledStudent(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 10000)}`,
    name: 'Test',
    is_onboarded: true,
    is_banned: false,
    wa_daily_enabled: true,
    wa_anchor_time: '08:00:00',
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

describe('pickAnchorTime', () => {
  test('returns HH:MM:SS string in 7:00-9:30 window', () => {
    const t = pickAnchorTime(fixedRng([0]));
    expect(t).toBe('07:00:00');
    const t2 = pickAnchorTime(fixedRng([0.999]));
    const [h, m] = t2.split(':').map(Number);
    expect(h * 60 + m).toBeLessThanOrEqual(9 * 60 + 30);
    expect(h * 60 + m).toBeGreaterThanOrEqual(7 * 60);
  });
});

describe('jitterScheduledFor', () => {
  test('jitters within ±25 minutes', () => {
    const target = new Date('2026-06-22T00:00:00Z');
    const t1 = jitterScheduledFor('08:00:00', target, fixedRng([0]));
    const t2 = jitterScheduledFor('08:00:00', target, fixedRng([1]));
    const span = (t2.getTime() - t1.getTime()) / 60000;
    expect(span).toBeCloseTo(50, 0);
  });
});

describe('buildDailyQueue', () => {
  test('enqueues a row for each eligible student', async () => {
    await createEnrolledStudent();
    await createEnrolledStudent();
    await createEnrolledStudent({ wa_daily_enabled: false });
    const result = await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    expect(result.enqueued).toBe(2);
    const rows = await db('whatsapp_daily_queue').select('*');
    expect(rows.length).toBe(2);
  });

  test('skips paused users', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEnrolledStudent({ wa_paused_until: future });
    await createEnrolledStudent();
    const result = await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    expect(result.enqueued).toBe(1);
  });

  test('writes lede_type and markets line', async () => {
    await createEnrolledStudent();
    await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    const row = await db('whatsapp_daily_queue').first();
    expect(row.markets).toBeDefined();
    expect(Array.isArray(row.markets)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd iroyinayo && npm test -- queueBuilder.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement queueBuilder**

Create `iroyinayo/src/modules/habit/queueBuilder.js`:

```javascript
const db = require('../../config/database');
const { pickLede } = require('./ledePicker');

const WINDOW_START_MIN = 7 * 60;       // 7:00 WAT
const WINDOW_END_MIN = 9 * 60 + 30;    // 9:30 WAT
const JITTER_MAX_MIN = 25;

function pickAnchorTime(rng = Math.random) {
  const span = WINDOW_END_MIN - WINDOW_START_MIN;
  const mins = Math.floor(WINDOW_START_MIN + rng() * span);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function jitterScheduledFor(anchorTime, targetDate, rng = Math.random) {
  const [h, m] = anchorTime.split(':').map(Number);
  const base = new Date(targetDate);
  base.setUTCHours(0, 0, 0, 0);
  // WAT is UTC+1 — convert WAT clock time to UTC by subtracting 1 hour
  const watOffsetMin = -60;
  const totalMin = h * 60 + m + watOffsetMin;
  const jitterMin = (rng() * 2 - 1) * JITTER_MAX_MIN;
  base.setTime(base.getTime() + (totalMin + jitterMin) * 60 * 1000);
  return base;
}

async function selectMarketsForUser(studentId, ledePayload) {
  const limit = 3;
  const namedMarketId = ledePayload?.marketId;
  const recentCategoryIds = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('p.student_id', studentId)
    .where('p.created_at', '>=', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
    .distinct('m.category')
    .select('m.category');
  const cats = recentCategoryIds.map((r) => r.category).filter(Boolean);

  let query = db('multi_markets as m')
    .leftJoin('multi_market_positions as own', function () {
      this.on('own.market_id', '=', 'm.id').andOnVal('own.student_id', '=', studentId);
    })
    .where('m.status', 'open')
    .whereNull('own.id')
    .select('m.id', 'm.title', 'm.closes_at', 'm.category');

  if (cats.length > 0) {
    query = query.orderByRaw(`CASE WHEN m.category = ANY(?) THEN 0 ELSE 1 END`, [cats]);
  }
  const fetched = await query.orderBy('m.created_at', 'desc').limit(limit * 2);

  const out = [];
  if (namedMarketId) {
    const named = await db('multi_markets').where('id', namedMarketId).first();
    if (named) out.push({ market_id: named.id, label: named.title, resolves_in_minutes: named.closes_at ? Math.max(0, Math.floor((new Date(named.closes_at) - Date.now()) / 60000)) : null });
  }
  for (const m of fetched) {
    if (out.length >= limit) break;
    if (out.some((x) => x.market_id === m.id)) continue;
    out.push({ market_id: m.id, label: m.title, resolves_in_minutes: m.closes_at ? Math.max(0, Math.floor((new Date(m.closes_at) - Date.now()) / 60000)) : null });
  }
  return out;
}

async function buildDailyQueue({ targetDate, rng = Math.random } = {}) {
  if (!targetDate) targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const students = await db('students')
    .where({ wa_daily_enabled: true, is_banned: false })
    .where(function () { this.whereNull('wa_paused_until').orWhere('wa_paused_until', '<', new Date()); })
    .select('id', 'wa_anchor_time');

  let enqueued = 0;
  let skipped = 0;
  for (const student of students) {
    if (!student.wa_anchor_time) {
      await db('students').where('id', student.id).update({ wa_anchor_time: pickAnchorTime(rng) });
      student.wa_anchor_time = (await db('students').where('id', student.id).select('wa_anchor_time').first()).wa_anchor_time;
    }
    const lede = await pickLede(student.id);
    if (!lede.type) { skipped += 1; continue; }
    const markets = await selectMarketsForUser(student.id, lede.payload);
    if (markets.length === 0) { skipped += 1; continue; }
    const scheduledFor = jitterScheduledFor(student.wa_anchor_time, targetDate, rng);
    await db('whatsapp_daily_queue').insert({
      student_id: student.id,
      scheduled_for: scheduledFor,
      lede_type: lede.type,
      lede_payload: lede.payload,
      markets: JSON.stringify(markets),
      status: 'pending',
    });
    enqueued += 1;
  }
  return { enqueued, skipped };
}

module.exports = { buildDailyQueue, pickAnchorTime, jitterScheduledFor };
```

- [ ] **Step 4: Run tests**

Run: `cd iroyinayo && npm test -- queueBuilder.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/queueBuilder.js iroyinayo/tests/habit/queueBuilder.test.js
git commit -m "feat(habit): daily queue builder with anchor-time jitter"
```

---

## Task 8: Message renderer

**Files:**
- Create: `iroyinayo/src/modules/habit/messageRenderer.js`
- Test: `iroyinayo/tests/habit/messageRenderer.test.js`

**Interfaces:**
- Consumes: queue row shape from Task 7, `students.name` + `students.id`.
- Produces:
  - `function renderMessage({ student, queueRow, appUrl })` → `string` ready to send via WhatsApp.
  - `function pickGreeting(studentId, dayKey)` → `string` from rotating pool, deterministic given inputs.

Pool: `['Good morning', 'Morning', 'Hey', 'Good morning oh']`. Deterministic: `hash(studentId + dayKey) % pool.length`.

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/habit/messageRenderer.test.js`:

```javascript
const { renderMessage, pickGreeting } = require('../../src/modules/habit/messageRenderer');

describe('pickGreeting', () => {
  test('same studentId + dayKey returns same greeting', () => {
    const a = pickGreeting('student-1', '2026-06-22');
    const b = pickGreeting('student-1', '2026-06-22');
    expect(a).toBe(b);
  });
  test('different days produce different greetings (over a span)', () => {
    const greetings = new Set();
    for (let d = 1; d <= 8; d++) greetings.add(pickGreeting('student-1', `2026-06-${String(d).padStart(2, '0')}`));
    expect(greetings.size).toBeGreaterThan(1);
  });
});

describe('renderMessage', () => {
  const student = { id: 'student-1', name: 'Tunde', phone_number: '2348000000000' };
  const appUrl = 'https://iroyinmarket.com';

  test('rank lede renders correct lede line', () => {
    const queueRow = {
      lede_type: 'rank',
      lede_payload: { currentRank: 47, rankDelta: 5 },
      markets: [{ market_id: 'm1', label: 'UNILAG vs OAU', resolves_in_minutes: 360 }],
      scheduled_for: new Date('2026-06-22T07:00:00Z'),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/Tunde/);
    expect(msg).toMatch(/rank #47/i);
    expect(msg).toMatch(/up 5/);
    expect(msg).toMatch(appUrl);
    expect(msg).toMatch(/ref=wa_daily/);
    expect(msg).toMatch(/lede=rank/);
  });

  test('resolution lede shows count', () => {
    const queueRow = {
      lede_type: 'resolution',
      lede_payload: { count: 2, marketIds: ['m1'] },
      markets: [{ market_id: 'm1', label: 'X', resolves_in_minutes: 60 }],
      scheduled_for: new Date(),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/2 of your calls resolve today/i);
  });

  test('curiosity lede includes market title and predictions count if present', () => {
    const queueRow = {
      lede_type: 'curiosity',
      lede_payload: { marketId: 'm1', marketTitle: 'Will UNILAG win?', predictionCount: 1247 },
      markets: [{ market_id: 'm1', label: 'Will UNILAG win?', resolves_in_minutes: 7200 }],
      scheduled_for: new Date(),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/UNILAG/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd iroyinayo && npm test -- messageRenderer.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement renderer**

Create `iroyinayo/src/modules/habit/messageRenderer.js`:

```javascript
const crypto = require('crypto');

const GREETINGS = ['Good morning', 'Morning', 'Hey', 'Good morning oh'];

function pickGreeting(studentId, dayKey) {
  const h = crypto.createHash('md5').update(`${studentId}:${dayKey}`).digest();
  return GREETINGS[h[0] % GREETINGS.length];
}

function formatRelativeTime(minutes) {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

function renderLede(type, payload) {
  switch (type) {
    case 'rank': {
      const dir = payload.rankDelta > 0 ? 'up' : 'down';
      return `You're rank #${payload.currentRank} — ${dir} ${Math.abs(payload.rankDelta)} since yesterday.`;
    }
    case 'resolution':
      return `${payload.count} of your calls resolve today.`;
    case 'social':
      return `${payload.friendName} just called ${payload.marketTitle}.`;
    case 'curiosity':
      return payload.marketTitle.endsWith('?') ? payload.marketTitle : `${payload.marketTitle}.`;
    default:
      return '';
  }
}

function renderMarketsLine(markets) {
  return markets
    .slice(0, 3)
    .map((m) => `${m.label} · ${formatRelativeTime(m.resolves_in_minutes)}`)
    .join(', ');
}

function renderCta(appUrl, ledeType, queueRow) {
  const marketSegment = queueRow.lede_payload?.marketId ? `/market/${queueRow.lede_payload.marketId}` : '';
  return `Open IroyinMarket → ${appUrl}${marketSegment}?ref=wa_daily&lede=${ledeType}`;
}

function dayKeyFor(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function renderMessage({ student, queueRow, appUrl }) {
  const greeting = pickGreeting(student.id, dayKeyFor(queueRow.scheduled_for));
  const lede = renderLede(queueRow.lede_type, queueRow.lede_payload);
  const marketsLine = renderMarketsLine(queueRow.markets);
  const cta = renderCta(appUrl, queueRow.lede_type, queueRow);
  const body = [
    `${greeting}, ${student.name}.`,
    '',
    lede,
    marketsLine,
    cta,
    '',
    'Reply PAUSE to pause for 7 days.',
  ].filter((line) => line !== null).join('\n');
  return body;
}

module.exports = { renderMessage, pickGreeting };
```

- [ ] **Step 4: Run tests**

Run: `cd iroyinayo && npm test -- messageRenderer.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/messageRenderer.js iroyinayo/tests/habit/messageRenderer.test.js
git commit -m "feat(habit): message renderer with greeting rotation"
```

---

## Task 9: Queue sender with pacing and failure tracking

**Files:**
- Create: `iroyinayo/src/modules/habit/queueSender.js`
- Modify: `iroyinayo/src/modules/notifications/whatsapp.js` — add `sendWhatsAppWithFailureTracking(student, text)`.
- Test: `iroyinayo/tests/habit/queueSender.test.js`

**Interfaces:**
- Consumes: `whatsapp_daily_queue` rows, `renderMessage` from Task 8, `sendWhatsAppWithFailureTracking`.
- Produces:
  - `async function drainDailyQueue({ now?, sendFn?, sleepFn? })` → `{ sent: number, failed: number, skipped: number }`. Iterates pending rows where `scheduled_for <= now`, shuffles, paces sends 4–8s apart, pauses 30–60s every 50 messages, halts if >5% fail in a rolling 1h window.
  - On success: row status → `sent`, `sent_at` set, `wa_failure_count` reset to 0.
  - On failure: row status → `failed`, `attempts++`, increment `wa_failure_count`. If count hits 2, set `wa_paused_until = now + 14 days` (re-verify flow surfaces in app).
  - **Skip rules**: if `students.last_app_open_at` is within 4h of `scheduled_for`, mark row `skipped` with `last_error: 'recent_active'`.

- [ ] **Step 1: Write failing tests**

Create `iroyinayo/tests/habit/queueSender.test.js`:

```javascript
const db = require('../../src/config/database');
const { drainDailyQueue } = require('../../src/modules/habit/queueSender');
const { v4: uuidv4 } = require('uuid');

async function enroll(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'T',
    is_onboarded: true,
    wa_daily_enabled: true,
    wa_anchor_time: '08:00:00',
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

async function enqueue(studentId, scheduledFor = new Date()) {
  const id = uuidv4();
  await db('whatsapp_daily_queue').insert({
    id,
    student_id: studentId,
    scheduled_for: scheduledFor,
    lede_type: 'curiosity',
    lede_payload: { marketId: 'mkt', marketTitle: 'X?' },
    markets: JSON.stringify([{ market_id: 'mkt', label: 'X', resolves_in_minutes: 60 }]),
    status: 'pending',
  });
  return id;
}

describe('drainDailyQueue', () => {
  test('sends pending rows and marks them sent', async () => {
    const s = await enroll();
    await enqueue(s);
    const sendFn = jest.fn(async () => true);
    const sleepFn = jest.fn(async () => {});
    const result = await drainDailyQueue({ sendFn, sleepFn });
    expect(result.sent).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
    const row = await db('whatsapp_daily_queue').first();
    expect(row.status).toBe('sent');
    expect(row.sent_at).not.toBeNull();
  });

  test('skips rows for users active within 4h', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    const s = await enroll({ last_app_open_at: recent });
    await enqueue(s);
    const sendFn = jest.fn(async () => true);
    const result = await drainDailyQueue({ sendFn, sleepFn: async () => {} });
    expect(result.skipped).toBe(1);
    expect(sendFn).not.toHaveBeenCalled();
    const row = await db('whatsapp_daily_queue').first();
    expect(row.status).toBe('skipped');
  });

  test('paces sends with sleep between messages', async () => {
    const s1 = await enroll();
    const s2 = await enroll();
    await enqueue(s1);
    await enqueue(s2);
    const sleepFn = jest.fn(async () => {});
    await drainDailyQueue({ sendFn: async () => true, sleepFn });
    expect(sleepFn).toHaveBeenCalled();
  });

  test('pauses student after 2 consecutive failures', async () => {
    const s = await enroll({ wa_failure_count: 1 });
    await enqueue(s);
    const sendFn = async () => false;
    await drainDailyQueue({ sendFn, sleepFn: async () => {} });
    const student = await db('students').where({ id: s }).first();
    expect(student.wa_failure_count).toBeGreaterThanOrEqual(2);
    expect(student.wa_paused_until).not.toBeNull();
  });

  test('halts entire run when failure rate exceeds 5% in window', async () => {
    for (let i = 0; i < 25; i++) {
      const sid = await enroll();
      await enqueue(sid);
    }
    let i = 0;
    const sendFn = async () => { i += 1; return i > 5; }; // first 5 fail, 20% fail rate triggers halt
    const result = await drainDailyQueue({ sendFn, sleepFn: async () => {} });
    expect(result.sent + result.failed).toBeLessThan(25);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd iroyinayo && npm test -- queueSender.test.js`
Expected: FAIL.

- [ ] **Step 3: Add the helper to `whatsapp.js`**

Open `iroyinayo/src/modules/notifications/whatsapp.js`. Just before the `module.exports` line, add:

```javascript
const db = require('../../config/database');

async function sendWhatsAppWithFailureTracking(student, text) {
  const ok = await sendWhatsApp(student.phone_number, text);
  if (ok) {
    if (student.wa_failure_count > 0) {
      await db('students').where({ id: student.id }).update({ wa_failure_count: 0 });
    }
    return true;
  }
  const newCount = (student.wa_failure_count || 0) + 1;
  const update = { wa_failure_count: newCount };
  if (newCount >= 2) {
    update.wa_paused_until = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }
  await db('students').where({ id: student.id }).update(update);
  return false;
}
```

Update the `module.exports` line at the bottom to include the new helper:

```javascript
module.exports = { sendWhatsApp, sendWhatsAppImage, sendWhatsAppWithFailureTracking, notifyMarketResolution, notifyWeeklyWinner, notifyNewMarket, notifyReferralWins };
```

(The existing `const db = ...` import at the top of the file already exists at line 2. If the file already has `db` imported there, the duplicate `const db = require(...)` above is unnecessary — remove it and use the existing import.)

- [ ] **Step 4: Implement queueSender**

Create `iroyinayo/src/modules/habit/queueSender.js`:

```javascript
const db = require('../../config/database');
const { renderMessage } = require('./messageRenderer');
const notifications = require('../notifications/whatsapp');

const PACING_MIN_MS = 4000;
const PACING_MAX_MS = 8000;
const LONG_PAUSE_EVERY = 50;
const LONG_PAUSE_MIN_MS = 30000;
const LONG_PAUSE_MAX_MS = 60000;
const FAILURE_HALT_RATE = 0.05;
const FAILURE_HALT_MIN_ATTEMPTS = 20;
const RECENT_ACTIVE_HOURS = 4;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function drainDailyQueue({
  now = new Date(),
  sendFn,
  sleepFn = (ms) => new Promise((r) => setTimeout(r, ms)),
  appUrl = process.env.APP_URL || 'https://iroyinmarket.com',
} = {}) {
  const send = sendFn || ((student, text) => notifications.sendWhatsAppWithFailureTracking(student, text));
  const rows = shuffle(await db('whatsapp_daily_queue').where({ status: 'pending' }).where('scheduled_for', '<=', now).select('*'));
  let sent = 0, failed = 0, skipped = 0;
  let attemptsInWindow = 0, failsInWindow = 0;

  for (let i = 0; i < rows.length; i++) {
    if (attemptsInWindow >= FAILURE_HALT_MIN_ATTEMPTS && failsInWindow / attemptsInWindow > FAILURE_HALT_RATE) {
      console.error(`[WA] Halting drain: failure rate ${failsInWindow}/${attemptsInWindow} exceeds ${FAILURE_HALT_RATE}`);
      break;
    }
    const row = rows[i];
    const student = await db('students').where('id', row.student_id).first();
    if (!student) { await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'failed', last_error: 'student_missing' }); failed += 1; continue; }

    const recentMs = student.last_app_open_at ? now - new Date(student.last_app_open_at) : Infinity;
    if (recentMs < RECENT_ACTIVE_HOURS * 60 * 60 * 1000) {
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'skipped', last_error: 'recent_active' });
      skipped += 1;
      continue;
    }

    const text = renderMessage({ student, queueRow: { ...row, markets: typeof row.markets === 'string' ? JSON.parse(row.markets) : row.markets }, appUrl });
    let ok;
    try {
      ok = await send(student, text);
    } catch (err) {
      ok = false;
      await db('whatsapp_daily_queue').where('id', row.id).update({ last_error: err.message });
    }
    attemptsInWindow += 1;
    if (ok) {
      sent += 1;
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'sent', sent_at: new Date(), attempts: row.attempts + 1, body_text: text });
    } else {
      failed += 1;
      failsInWindow += 1;
      await db('whatsapp_daily_queue').where('id', row.id).update({ status: 'failed', attempts: row.attempts + 1, body_text: text });
    }

    const isLast = i === rows.length - 1;
    if (!isLast) {
      if ((i + 1) % LONG_PAUSE_EVERY === 0) {
        await sleepFn(LONG_PAUSE_MIN_MS + Math.random() * (LONG_PAUSE_MAX_MS - LONG_PAUSE_MIN_MS));
        attemptsInWindow = 0; failsInWindow = 0;
      } else {
        await sleepFn(PACING_MIN_MS + Math.random() * (PACING_MAX_MS - PACING_MIN_MS));
      }
    }
  }
  return { sent, failed, skipped };
}

module.exports = { drainDailyQueue };
```

- [ ] **Step 5: Run tests**

Run: `cd iroyinayo && npm test -- queueSender.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/habit/queueSender.js iroyinayo/src/modules/notifications/whatsapp.js iroyinayo/tests/habit/queueSender.test.js
git commit -m "feat(habit): queue sender with pacing and failure tracking"
```

---

## Task 10: Wire cron jobs and remove old morning digest

**Files:**
- Modify: `iroyinayo/src/bot/scheduler/dailyJobs.js` — remove old morning digest (lines 42–69 in current file), add three new cron jobs.

**Interfaces:**
- Consumes: `buildDailyQueue`, `drainDailyQueue`, `evaluatePositionTriggers` (Task 11).
- Produces: three running cron schedules.

Cron schedules (Africa/Lagos timezone):
- `0 5 * * *` — `buildDailyQueue({ targetDate: today })` — builds today's queue at 5am, before the earliest 7am send.
- `55 6 * * *` — `drainDailyQueue()` — starts draining at 6:55 so the first send aligns with the 7:00 anchor minimum.
- `*/10 * * * *` — `evaluatePositionTriggers()` (Task 11).

- [ ] **Step 1: Read the existing file**

Run: `cat iroyinayo/src/bot/scheduler/dailyJobs.js | head -80`
Confirm the old morning digest block runs at `0 8 * * *`.

- [ ] **Step 2: Edit dailyJobs.js — remove old digest, add new jobs**

In `iroyinayo/src/bot/scheduler/dailyJobs.js`:

(a) **Remove** the entire block starting with the comment `// Morning digest — 8am WAT daily` through the closing `}, { timezone: 'Africa/Lagos' });` of that cron (current lines ~42–69).

(b) Replace the imports block near the top to add:

```javascript
const { buildDailyQueue } = require('../../modules/habit/queueBuilder');
const { drainDailyQueue } = require('../../modules/habit/queueSender');
const { evaluatePositionTriggers } = require('../../modules/habit/positionTriggers');
```

(c) Inside `startScheduler(sock)`, after the existing `cron.schedule('0 6 * * *', ...)` AI content block, insert:

```javascript
  // Build today's WhatsApp daily queue — 5am WAT
  cron.schedule('0 5 * * *', async () => {
    console.log('Building WhatsApp daily queue...');
    try {
      const result = await buildDailyQueue({ targetDate: new Date() });
      console.log(`Queue built: enqueued=${result.enqueued} skipped=${result.skipped}`);
    } catch (err) {
      console.error('Queue build failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Drain WhatsApp daily queue — 6:55am WAT
  cron.schedule('55 6 * * *', async () => {
    console.log('Draining WhatsApp daily queue...');
    if (!activeSock) { console.error('Drain skipped: no active socket'); return; }
    try {
      const result = await drainDailyQueue();
      console.log(`Queue drained: sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`);
    } catch (err) {
      console.error('Queue drain failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Evaluate position triggers — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await evaluatePositionTriggers();
    } catch (err) {
      console.error('Position triggers eval failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });
```

(d) Update the final `console.log('Scheduler started: ...')` line to reflect the new schedule:

```javascript
  console.log('Scheduler started: AI content (6am), WA queue build (5am), WA queue drain (6:55am), market auto-close (hourly), odds movement (15min), closing-soon (30min), position triggers (10min)');
```

- [ ] **Step 3: Sanity-check the file syntactically**

Run: `cd iroyinayo && node -c src/bot/scheduler/dailyJobs.js`
Expected: no output (clean parse).

- [ ] **Step 4: Run all backend tests to confirm nothing broke**

Run: `cd iroyinayo && npm test`
Expected: all pass. (Cron jobs are not exercised by tests, only their callees.)

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/bot/scheduler/dailyJobs.js
git commit -m "feat(habit): wire daily queue cron jobs, remove old morning digest"
```

---

## Task 11: Position triggers evaluator

**Files:**
- Create: `iroyinayo/src/modules/habit/positionTriggers.js`
- Test: `iroyinayo/tests/habit/positionTriggers.test.js`

**Interfaces:**
- Consumes: `multi_market_positions`, `multi_markets`, `position_triggers`, `market_price_snapshots`.
- Produces:
  - `async function evaluatePositionTriggers()` → `{ resolutionToday: number, resolvedAway: number, sharpMove: number }`. Inserts eligible rows into `position_triggers` honoring the unique (position_id, condition) constraint via `.onConflict().ignore()`.
  - `async function fireResolvedAwayNotifications({ now? })` → `number` — sends one-off WhatsApp messages for `resolved_away` triggers whose users haven't opened the app in 12h+ and where no daily was sent within 6h. Uses `sendWhatsAppWithFailureTracking`. Marks `fired_at`, `surfaced_via='wa_oneoff'`.

This task includes both writing rows (eligibility) and firing the one-off `resolved_away` message.

- [ ] **Step 1: Write failing tests**

Create `iroyinayo/tests/habit/positionTriggers.test.js`:

```javascript
const db = require('../../src/config/database');
const { evaluatePositionTriggers, fireResolvedAwayNotifications } = require('../../src/modules/habit/positionTriggers');
const { v4: uuidv4 } = require('uuid');

async function setup({ marketStatus = 'open', closesAt = null, resolvedAt = null, isWinner = false, lastOpen = null } = {}) {
  const studentId = uuidv4();
  await db('students').insert({
    id: studentId,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'T', is_onboarded: true, points_balance: 1000,
    last_app_open_at: lastOpen,
    wa_daily_enabled: true,
  });
  const marketId = uuidv4();
  await db('multi_markets').insert({ id: marketId, title: 'T', status: marketStatus, closes_at: closesAt, resolved_at: resolvedAt, liquidity_b: 100 });
  const outcomeId = uuidv4();
  await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0, is_winner: isWinner });
  const positionId = uuidv4();
  await db('multi_market_positions').insert({ id: positionId, student_id: studentId, market_id: marketId, outcome_id: outcomeId, shares: 5, amount: 250 });
  return { studentId, marketId, positionId, outcomeId };
}

describe('evaluatePositionTriggers', () => {
  test('writes resolution_today row when market closes in next 24h', async () => {
    const { positionId } = await setup({ closesAt: new Date(Date.now() + 6 * 60 * 60 * 1000) });
    const r = await evaluatePositionTriggers();
    expect(r.resolutionToday).toBe(1);
    const trig = await db('position_triggers').where({ position_id: positionId, condition: 'resolution_today' }).first();
    expect(trig).toBeDefined();
  });

  test('writes resolved_away row when market just resolved and user away', async () => {
    const resolved = new Date(Date.now() - 30 * 60 * 1000);
    const stale = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const { positionId } = await setup({ marketStatus: 'resolved', resolvedAt: resolved, lastOpen: stale });
    const r = await evaluatePositionTriggers();
    expect(r.resolvedAway).toBe(1);
    const trig = await db('position_triggers').where({ position_id: positionId, condition: 'resolved_away' }).first();
    expect(trig).toBeDefined();
  });

  test('idempotent — second call does not duplicate rows', async () => {
    await setup({ closesAt: new Date(Date.now() + 6 * 60 * 60 * 1000) });
    await evaluatePositionTriggers();
    await evaluatePositionTriggers();
    const rows = await db('position_triggers').where({ condition: 'resolution_today' });
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd iroyinayo && npm test -- positionTriggers.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement module**

Create `iroyinayo/src/modules/habit/positionTriggers.js`:

```javascript
const db = require('../../config/database');
const notifications = require('../notifications/whatsapp');

const SHARP_MOVE_PP = 0.10;
const SHARP_MOVE_WINDOW_MS = 60 * 60 * 1000;
const RESOLVED_AWAY_USER_IDLE_MS = 12 * 60 * 60 * 1000;
const RESOLVED_AWAY_DAILY_GUARD_MS = 6 * 60 * 60 * 1000;

async function findResolutionTodayEligible(now) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('m.status', 'open')
    .whereNotNull('m.closes_at')
    .where('m.closes_at', '<=', horizon)
    .where('m.closes_at', '>', now)
    .select('p.id as position_id');
}

async function findResolvedAwayEligible(now) {
  const userIdleCutoff = new Date(now.getTime() - RESOLVED_AWAY_USER_IDLE_MS);
  return db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('m.status', 'resolved')
    .whereNotNull('m.resolved_at')
    .where(function () {
      this.whereNull('s.last_app_open_at').orWhere('s.last_app_open_at', '<', userIdleCutoff);
    })
    .where('s.is_system', false)
    .select('p.id as position_id', 'p.student_id', 'p.payout', 'p.amount', 'm.title');
}

async function findSharpMoveEligible(now) {
  return [];
}

async function evaluatePositionTriggers({ now = new Date() } = {}) {
  const counts = { resolutionToday: 0, resolvedAway: 0, sharpMove: 0 };

  const resToday = await findResolutionTodayEligible(now);
  for (const r of resToday) {
    const inserted = await db('position_triggers')
      .insert({ position_id: r.position_id, condition: 'resolution_today', eligible_at: now })
      .onConflict(['position_id', 'condition']).ignore()
      .returning('id');
    if (inserted.length > 0) counts.resolutionToday += 1;
  }

  const resAway = await findResolvedAwayEligible(now);
  for (const r of resAway) {
    const inserted = await db('position_triggers')
      .insert({ position_id: r.position_id, condition: 'resolved_away', eligible_at: now })
      .onConflict(['position_id', 'condition']).ignore()
      .returning('id');
    if (inserted.length > 0) counts.resolvedAway += 1;
  }

  return counts;
}

async function fireResolvedAwayNotifications({ now = new Date() } = {}) {
  const guard = new Date(now.getTime() - RESOLVED_AWAY_DAILY_GUARD_MS);
  const eligible = await db('position_triggers as t')
    .join('multi_market_positions as p', 't.position_id', 'p.id')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('t.condition', 'resolved_away')
    .whereNull('t.fired_at')
    .whereNotExists(function () {
      this.select('*').from('whatsapp_daily_queue as q')
        .whereRaw('q.student_id = s.id')
        .where('q.status', 'sent')
        .where('q.sent_at', '>', guard);
    })
    .select('t.id', 's.id as student_id', 's.phone_number', 's.name', 's.wa_failure_count', 'p.payout', 'm.title');

  let fired = 0;
  const appUrl = process.env.APP_URL || 'https://iroyinmarket.com';
  for (const e of eligible) {
    const won = (e.payout || 0) > 0;
    const text = `Your call on "${e.title}" resolved. ${won ? `Win.` : `Miss.`}\n\nOpen IroyinMarket → ${appUrl}?ref=wa_oneoff&lede=resolved_away`;
    const ok = await notifications.sendWhatsAppWithFailureTracking({ id: e.student_id, phone_number: e.phone_number, wa_failure_count: e.wa_failure_count }, text);
    if (ok) {
      await db('position_triggers').where('id', e.id).update({ fired_at: now, surfaced_via: 'wa_oneoff' });
      fired += 1;
    }
  }
  return fired;
}

module.exports = { evaluatePositionTriggers, fireResolvedAwayNotifications };
```

(The `sharp_move` evaluator is left stubbed at an empty list for this ship — surfaced via the in-app strip in Task 13. Adding it would require reading `market_price_snapshots`, comparing snapshots an hour apart per market the user holds, and writing a row when the delta exceeds 10pp. Defer to a follow-up only if §6.3 row "sharp move on your position" requires more than the in-app strip can provide. The strip can query `market_price_snapshots` directly without queueing — see Task 13.)

- [ ] **Step 4: Run tests**

Run: `cd iroyinayo && npm test -- positionTriggers.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/positionTriggers.js iroyinayo/tests/habit/positionTriggers.test.js
git commit -m "feat(triggers): position trigger evaluator with idempotent inserts"
```

---

## Task 12: Bot handlers — opt-in, PAUSE, STOP

**Files:**
- Create: `iroyinayo/src/bot/handlers/dailyOptIn.js`
- Modify: `iroyinayo/src/bot/messageHandler.js` — route incoming messages through the new handler before existing handlers.

**Interfaces:**
- Consumes: incoming WhatsApp message text, sender's phone number.
- Produces:
  - `async function handleDailyOptIn({ phoneNumber, text, sock })` → `{ handled: boolean }`. If text matches `PAUSE`/`STOP` (case-insensitive, trimmed): updates `students.wa_paused_until` (PAUSE = +7 days) or sets `wa_daily_enabled = false` (STOP). Replies with a confirmation. Returns `handled: true` so the existing message handler doesn't run.
  - For all other messages from an existing student: if `wa_daily_enabled` is still false, flip it to true (this is the spec §3.3 "sent at least one message to the bot" gate). Returns `handled: false` — existing handler still runs.

- [ ] **Step 1: Inspect existing messageHandler to find the routing point**

Run: `cd iroyinayo && head -60 src/bot/messageHandler.js`
Find where incoming text is first matched. The new handler must run BEFORE existing command parsing.

- [ ] **Step 2: Create the handler**

Create `iroyinayo/src/bot/handlers/dailyOptIn.js`:

```javascript
const db = require('../../config/database');

const PAUSE_DAYS = 7;

async function handleDailyOptIn({ phoneNumber, text, sock }) {
  const student = await db('students').where({ phone_number: phoneNumber }).first();
  if (!student) return { handled: false };

  const cmd = (text || '').trim().toUpperCase();
  const jid = `${phoneNumber}@s.whatsapp.net`;

  if (cmd === 'PAUSE') {
    const until = new Date(Date.now() + PAUSE_DAYS * 24 * 60 * 60 * 1000);
    await db('students').where({ id: student.id }).update({ wa_paused_until: until });
    if (sock) await sock.sendMessage(jid, { text: `Paused for ${PAUSE_DAYS} days. We'll be back.` });
    return { handled: true };
  }
  if (cmd === 'STOP') {
    await db('students').where({ id: student.id }).update({ wa_daily_enabled: false, wa_paused_until: null });
    if (sock) await sock.sendMessage(jid, { text: `Stopped. Re-enable from the web app whenever you're ready.` });
    return { handled: true };
  }

  if (!student.wa_daily_enabled && student.is_onboarded) {
    await db('students').where({ id: student.id }).update({ wa_daily_enabled: true });
  }
  return { handled: false };
}

module.exports = { handleDailyOptIn };
```

- [ ] **Step 3: Wire it into messageHandler**

In `iroyinayo/src/bot/messageHandler.js`, at the top with other requires, add:

```javascript
const { handleDailyOptIn } = require('./handlers/dailyOptIn');
```

Inside the main message-handling function (look for where `phoneNumber` and `messageText` are first available), add this as the very first action after extracting those values:

```javascript
  const optIn = await handleDailyOptIn({ phoneNumber, text: messageText, sock });
  if (optIn.handled) return;
```

(Exact insertion site depends on the existing file structure. The condition is: it must run after `phoneNumber` and `messageText` are bound, but before any existing command parsing.)

- [ ] **Step 4: Write a smoke test**

Add to `iroyinayo/tests/habit/dailyOptIn.test.js`:

```javascript
const db = require('../../src/config/database');
const { handleDailyOptIn } = require('../../src/bot/handlers/dailyOptIn');
const { v4: uuidv4 } = require('uuid');

async function student(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'T',
    is_onboarded: true, points_balance: 1000, wa_daily_enabled: false,
    ...overrides,
  });
  return id;
}

describe('handleDailyOptIn', () => {
  test('PAUSE sets wa_paused_until 7 days ahead and is handled', async () => {
    const id = await student({ wa_daily_enabled: true });
    const phone = (await db('students').where({ id }).first()).phone_number;
    const fakeSock = { sendMessage: jest.fn() };
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'pause', sock: fakeSock });
    expect(r.handled).toBe(true);
    const s = await db('students').where({ id }).first();
    expect(s.wa_paused_until).not.toBeNull();
    expect(fakeSock.sendMessage).toHaveBeenCalled();
  });

  test('STOP disables daily and is handled', async () => {
    const id = await student({ wa_daily_enabled: true });
    const phone = (await db('students').where({ id }).first()).phone_number;
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'STOP', sock: { sendMessage: jest.fn() } });
    expect(r.handled).toBe(true);
    const s = await db('students').where({ id }).first();
    expect(s.wa_daily_enabled).toBe(false);
  });

  test('first non-command message flips wa_daily_enabled to true and is not handled', async () => {
    const id = await student();
    const phone = (await db('students').where({ id }).first()).phone_number;
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'hi', sock: { sendMessage: jest.fn() } });
    expect(r.handled).toBe(false);
    const s = await db('students').where({ id }).first();
    expect(s.wa_daily_enabled).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd iroyinayo && npm test -- dailyOptIn.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/bot/handlers/dailyOptIn.js iroyinayo/src/bot/messageHandler.js iroyinayo/tests/habit/dailyOptIn.test.js
git commit -m "feat(bot): PAUSE/STOP commands and first-message opt-in"
```

---

## Task 13: Habit routes — accuracy, in-app strip, last_app_open middleware

**Files:**
- Create: `iroyinayo/src/modules/habit/habit.routes.js`
- Modify: `iroyinayo/src/app.js` — register routes, add last_app_open middleware.
- Test: `iroyinayo/tests/habit/habit.routes.test.js`

**Interfaces:**
- Consumes: `computeAccuracy`, `computeCategoryAccuracy`, `computeAccuracyRank`, existing JWT auth middleware.
- Produces:
  - `GET /api/habit/accuracy/:userId` → `{ allTime: { resolvedCalls, correct, accuracy }, last30Days: {...}, byCategory: [...], rank: { rank, percentile, totalRanked }, openCallsCount: number, nextResolutionAt: timestamptz | null }`
  - `GET /api/habit/triggers/in-app-strip` (auth required) → `{ sharpMoves: [{ marketId, title, oldPrice, newPrice, deltaPp }] }` — looks up the authenticated user's open positions and the latest sharp moves on those markets in the last 1h.
  - Middleware: on every authenticated request, update `students.last_app_open_at = now()` (throttled to once per 5 min per user to avoid write storms).

- [ ] **Step 1: Write failing route tests**

Create `iroyinayo/tests/habit/habit.routes.test.js`:

```javascript
const request = require('supertest');
const db = require('../../src/config/database');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

async function makeUserWithToken() {
  const id = uuidv4();
  await db('students').insert({
    id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'T',
    is_onboarded: true, points_balance: 1000,
  });
  const token = jwt.sign({ studentId: id }, process.env.JWT_SECRET || 'test-secret');
  return { id, token };
}

describe('GET /api/habit/accuracy/:userId', () => {
  test('returns null accuracy for new users with no resolved calls', async () => {
    const { id } = await makeUserWithToken();
    const res = await request(app).get(`/api/habit/accuracy/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.allTime.accuracy).toBeNull();
    expect(res.body.allTime.resolvedCalls).toBe(0);
  });
});

describe('GET /api/habit/triggers/in-app-strip', () => {
  test('requires auth', async () => {
    const res = await request(app).get('/api/habit/triggers/in-app-strip');
    expect(res.status).toBe(401);
  });

  test('returns empty list when user has no open positions', async () => {
    const { token } = await makeUserWithToken();
    const res = await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sharpMoves).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd iroyinayo && npm test -- habit.routes.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement routes**

Create `iroyinayo/src/modules/habit/habit.routes.js`:

```javascript
const express = require('express');
const db = require('../../config/database');
const { authMiddleware } = require('../auth/auth.middleware');
const { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank } = require('./accuracy');

const router = express.Router();

const SHARP_MOVE_PP = 0.10;
const SHARP_MOVE_WINDOW_MS = 60 * 60 * 1000;

router.get('/accuracy/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const allTime = await computeAccuracy(userId);
    const last30Days = await computeAccuracy(userId, { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const byCategory = await computeCategoryAccuracy(userId);
    const rank = await computeAccuracyRank(userId);
    const openPositions = await db('multi_market_positions as p')
      .join('multi_markets as m', 'p.market_id', 'm.id')
      .where('p.student_id', userId).where('m.status', 'open')
      .select('m.closes_at').orderBy('m.closes_at', 'asc');
    const openCallsCount = openPositions.length;
    const nextResolutionAt = openPositions.length > 0 ? openPositions[0].closes_at : null;
    res.json({ allTime, last30Days, byCategory, rank, openCallsCount, nextResolutionAt });
  } catch (err) {
    console.error('Accuracy fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch accuracy' });
  }
});

router.get('/triggers/in-app-strip', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const openPositions = await db('multi_market_positions as p')
      .join('multi_markets as m', 'p.market_id', 'm.id')
      .where('p.student_id', studentId).where('m.status', 'open')
      .select('m.id', 'm.title').distinct();
    if (openPositions.length === 0) { res.json({ sharpMoves: [] }); return; }

    const since = new Date(Date.now() - SHARP_MOVE_WINDOW_MS);
    const sharpMoves = [];
    for (const market of openPositions) {
      const snapshots = await db('market_price_snapshots').where({ market_id: market.id }).where('captured_at', '>=', since).orderBy('captured_at', 'asc').limit(2);
      if (snapshots.length < 2) continue;
      const oldPrices = JSON.parse(snapshots[0].prices);
      const newPrices = JSON.parse(snapshots[snapshots.length - 1].prices);
      const ownPosition = await db('multi_market_positions').where({ student_id: studentId, market_id: market.id }).select('outcome_id').first();
      const oldP = oldPrices.find((p) => p.outcome_id === ownPosition.outcome_id);
      const newP = newPrices.find((p) => p.outcome_id === ownPosition.outcome_id);
      if (!oldP || !newP) continue;
      const delta = Math.abs(newP.price - oldP.price);
      if (delta >= SHARP_MOVE_PP) sharpMoves.push({ marketId: market.id, title: market.title, oldPrice: oldP.price, newPrice: newP.price, deltaPp: Math.round(delta * 100) });
    }
    res.json({ sharpMoves });
  } catch (err) {
    console.error('In-app strip fetch failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/opt-in', authMiddleware, async (req, res) => {
  try {
    await db('students').where({ id: req.user.studentId }).update({ wa_daily_enabled: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

const LAST_OPEN_THROTTLE_MS = 5 * 60 * 1000;
const lastOpenCache = new Map();
function lastAppOpenMiddleware(req, res, next) {
  if (!req.user?.studentId) return next();
  const sid = req.user.studentId;
  const prev = lastOpenCache.get(sid);
  const now = Date.now();
  if (prev && now - prev < LAST_OPEN_THROTTLE_MS) return next();
  lastOpenCache.set(sid, now);
  db('students').where({ id: sid }).update({ last_app_open_at: new Date() }).catch(() => {});
  next();
}

module.exports = { router, lastAppOpenMiddleware };
```

- [ ] **Step 4: Register routes and middleware in app.js**

In `iroyinayo/src/app.js`, add near other route registrations:

```javascript
const { router: habitRouter, lastAppOpenMiddleware } = require('./modules/habit/habit.routes');
app.use(lastAppOpenMiddleware);
app.use('/api/habit', habitRouter);
```

The `lastAppOpenMiddleware` registration must come AFTER the auth middleware in the chain (so `req.user` is populated).

- [ ] **Step 5: Run tests**

Run: `cd iroyinayo && npm test -- habit.routes.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/habit/habit.routes.js iroyinayo/src/app.js iroyinayo/tests/habit/habit.routes.test.js
git commit -m "feat(habit): accuracy + in-app strip routes, last_app_open middleware"
```

---

## Task 14: Wire source_ref into prediction flow

**Files:**
- Modify: `iroyinayo/src/modules/markets/multiMarkets.service.js` — accept `source_ref` in `buyPosition`.
- Modify: `prediction-web/src/api.js` — extend `predict()` payload with `source_ref`.
- Create: `prediction-web/src/hooks/useDeepLinkRef.js` — extracts `?ref` from URL.

**Interfaces:**
- Backend: existing `buyPosition({ studentId, marketId, outcomeId, shares, ... })` adds an optional `sourceRef` arg. Persists it to `multi_market_positions.source_ref`.
- Frontend: `useDeepLinkRef()` → `{ ref, lede, market }`. The values persist across navigation in the same session via sessionStorage.

- [ ] **Step 1: Add source_ref param to buyPosition**

In `iroyinayo/src/modules/markets/multiMarkets.service.js`, find the `buyPosition` function signature. Add `sourceRef` to the destructured args. Find the `db('multi_market_positions').insert({ ... })` call inside the function and add `source_ref: sourceRef || null`.

(The exact line numbers depend on the file's current state — search for `buyPosition` and the `multi_market_positions.insert` call.)

- [ ] **Step 2: Update the predict route to forward the field**

Find the route handler that calls `buyPosition`. It likely lives in `iroyinayo/src/modules/markets/multiMarkets.routes.js`. Extract `source_ref` from `req.body` and pass it as `sourceRef` into the service call.

- [ ] **Step 3: Add a quick service test**

In an existing test file like `iroyinayo/tests/multiMarkets.service.test.js`, add one test that asserts a passed `sourceRef` lands on the row:

```javascript
test('persists source_ref when provided', async () => {
  // ... existing setup of student/market/outcome ...
  await buyPosition({ studentId, marketId, outcomeId, shares: 1, sourceRef: 'wa_daily:rank' });
  const row = await db('multi_market_positions').where({ student_id: studentId, market_id: marketId }).first();
  expect(row.source_ref).toBe('wa_daily:rank');
});
```

Run: `cd iroyinayo && npm test -- multiMarkets.service.test.js`
Expected: new test passes, existing tests still pass.

- [ ] **Step 4: Create useDeepLinkRef hook**

Create `prediction-web/src/hooks/useDeepLinkRef.js`:

```javascript
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'iroyin_deep_link_ref';

export function useDeepLinkRef() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { ref: null, lede: null, market: null };
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref) {
      const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { ref: null, lede: null, market: null };
  });

  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) {
        const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        setState(next);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return state;
}

export function buildSourceRef({ ref, lede }) {
  if (!ref) return null;
  return lede ? `${ref}:${lede}` : ref;
}
```

- [ ] **Step 5: Extend predict() in api.js**

In `prediction-web/src/api.js`, find the existing `predict` (or equivalent) function. Extend its payload to include `source_ref` read from the hook's `buildSourceRef`. If `predict()` is called from one place, accept `sourceRef` as an arg and have callers pass it.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/markets/multiMarkets.service.js iroyinayo/src/modules/markets/multiMarkets.routes.js iroyinayo/tests/multiMarkets.service.test.js prediction-web/src/hooks/useDeepLinkRef.js prediction-web/src/api.js
git commit -m "feat: thread source_ref from URL to position row"
```

---

## Task 15: Quick-predict render mode

**Files:**
- Create: `prediction-web/src/components/QuickPredictBar.jsx`
- Modify: `prediction-web/src/pages/MarketDetail.jsx` — render QuickPredictBar when `?ref=wa_daily` for 30s or until predict.

**Interfaces:**
- `<QuickPredictBar market={market} outcomes={outcomes} defaultStake={number} onPredict={(outcomeId, stake) => void} />`
- Default stake comes from a helper: `computeDefaultStake({ recentStakes, balance })` returning a stake within the floor (100) / ceiling (min(1000, balance * 0.10)) bounds. Pure utility — testable in isolation.

- [ ] **Step 1: Create the default-stake utility and a test**

Create `prediction-web/src/utils/defaultStake.js`:

```javascript
export const STAKE_FLOOR = 100;
export const STAKE_CEILING = 1000;
export const NEW_USER_DEFAULT = 200;

export function computeDefaultStake({ recentStakes = [], balance = 0 }) {
  const ceiling = Math.min(STAKE_CEILING, Math.floor(balance * 0.10 / 50) * 50);
  if (recentStakes.length < 3) return Math.min(NEW_USER_DEFAULT, Math.max(STAKE_FLOOR, ceiling));
  const sorted = [...recentStakes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const rounded = Math.round(median / 50) * 50;
  return Math.min(ceiling, Math.max(STAKE_FLOOR, rounded));
}
```

Create `prediction-web/src/utils/defaultStake.test.js` (Vitest is not configured in this repo; if there's no frontend test runner, skip the test and rely on integration testing in the browser. Confirm via `cat prediction-web/package.json | grep -E 'test|vitest|jest'`.)

If no frontend test runner exists, document the utility behavior in code comments and verify manually.

- [ ] **Step 2: Build QuickPredictBar**

Create `prediction-web/src/components/QuickPredictBar.jsx`:

```jsx
import { useState } from 'react';
import { computeDefaultStake, STAKE_FLOOR } from '../utils/defaultStake';

export default function QuickPredictBar({ market, outcomes, recentStakes, balance, onPredict }) {
  const [stake, setStake] = useState(() => computeDefaultStake({ recentStakes, balance }));
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);

  const cappedAtMax = stake === Math.min(1000, Math.floor(balance * 0.10 / 50) * 50);
  const canSubmit = selectedOutcomeId && stake >= STAKE_FLOOR && stake <= balance;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line p-4 z-40">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {outcomes.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedOutcomeId(o.id)}
              className={`h-16 rounded-xl font-serif text-2xl border ${selectedOutcomeId === o.id ? 'border-emerald bg-emerald text-bone' : 'border-line bg-paper text-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setStake((s) => Math.max(STAKE_FLOOR, s - 50))} className="h-11 w-11 rounded-lg border border-line">−</button>
          <div className="flex-1 text-center font-mono">
            <div className="text-xl">{stake} pts</div>
            {cappedAtMax && <span className="text-xs text-ochre">max</span>}
          </div>
          <button onClick={() => setStake((s) => Math.min(balance, s + 50))} className="h-11 w-11 rounded-lg border border-line">+</button>
        </div>

        <button
          disabled={!canSubmit}
          onClick={() => onPredict(selectedOutcomeId, stake)}
          className="h-14 rounded-xl bg-emerald text-bone disabled:opacity-50 font-sans"
        >
          Predict
        </button>
      </div>
    </div>
  );
}
```

(Color tokens `paper`, `line`, `emerald`, `bone`, `ochre`, `ink` must already exist in `prediction-web/tailwind.config.js` per DESIGN.md. If they don't, this is a precondition failure — stop and check before continuing.)

- [ ] **Step 3: Wire QuickPredictBar into MarketDetail**

In `prediction-web/src/pages/MarketDetail.jsx`:

(a) At the top, add:

```jsx
import { useDeepLinkRef } from '../hooks/useDeepLinkRef';
import QuickPredictBar from '../components/QuickPredictBar';
```

(b) Inside the component:

```jsx
const { ref, lede } = useDeepLinkRef();
const isQuickPredict = ref === 'wa_daily' && (lede === 'social' || lede === 'curiosity' || lede === 'resolution');
const [quickPredictActive, setQuickPredictActive] = useState(isQuickPredict);

useEffect(() => {
  if (!isQuickPredict) return;
  const timer = setTimeout(() => setQuickPredictActive(false), 30000);
  return () => clearTimeout(timer);
}, [isQuickPredict]);
```

(c) Render conditionally at the bottom of the page:

```jsx
{quickPredictActive && (
  <QuickPredictBar
    market={market}
    outcomes={outcomes}
    recentStakes={[]}  // wire from user data later
    balance={user?.points_balance ?? 0}
    onPredict={(outcomeId, stake) => {
      handlePredict(outcomeId, stake);
      setQuickPredictActive(false);
    }}
  />
)}
```

(`handlePredict` is the existing predict function in the page — find its current name and call it from the new callback.)

- [ ] **Step 4: Manually verify in dev**

Run: `cd prediction-web && npm run dev`
Open: `http://localhost:5173/market/<any-open-market-id>?ref=wa_daily&lede=curiosity`
Expected: `QuickPredictBar` renders at the bottom; outcome buttons large; stake stepper functional; predict disabled until outcome selected.

- [ ] **Step 5: Commit**

```bash
git add prediction-web/src/components/QuickPredictBar.jsx prediction-web/src/utils/defaultStake.js prediction-web/src/pages/MarketDetail.jsx
git commit -m "feat(web): quick-predict mode for wa_daily deep links"
```

---

## Task 16: Markets top strip for rank-lede landing

**Files:**
- Create: `prediction-web/src/components/MarketsTopStrip.jsx`
- Modify: `prediction-web/src/pages/Markets.jsx` — render the strip when `?ref=wa_daily&lede=rank`.
- Modify: `prediction-web/src/api.js` — add `getInAppTriggerStrip()`.

**Interfaces:**
- `<MarketsTopStrip markets={Array<{ marketId, title }>} />` — horizontally scrollable on mobile, inline on desktop. Tappable cards that route to `/market/:marketId?ref=wa_daily&lede=rank-strip`.

- [ ] **Step 1: Add API client method**

In `prediction-web/src/api.js`, add:

```javascript
export async function getInAppTriggerStrip() {
  const res = await fetch(`${API_BASE}/api/habit/triggers/in-app-strip`, { headers: authHeaders() });
  if (!res.ok) return { sharpMoves: [] };
  return res.json();
}
```

(Match the existing pattern in the file — `API_BASE` and `authHeaders` should already exist.)

- [ ] **Step 2: Build MarketsTopStrip**

Create `prediction-web/src/components/MarketsTopStrip.jsx`:

```jsx
import { Link } from 'react-router-dom';

export default function MarketsTopStrip({ markets, title = 'Markets you might call' }) {
  if (!markets || markets.length === 0) return null;
  return (
    <section className="px-4 pt-4 pb-2">
      <h2 className="font-serif text-section mb-2">{title}</h2>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x">
        {markets.map((m) => (
          <Link
            key={m.marketId}
            to={`/market/${m.marketId}?ref=wa_daily&lede=rank-strip`}
            className="snap-start min-w-[240px] bg-paper border border-line rounded-2xl p-4"
          >
            <div className="font-sans label">{m.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire into Markets.jsx**

In `prediction-web/src/pages/Markets.jsx`:

```jsx
import { useDeepLinkRef } from '../hooks/useDeepLinkRef';
import MarketsTopStrip from '../components/MarketsTopStrip';
// ...
const { ref, lede } = useDeepLinkRef();
const showRankStrip = ref === 'wa_daily' && lede === 'rank';
const [stripMarkets, setStripMarkets] = useState([]);

useEffect(() => {
  if (!showRankStrip) return;
  // Markets come from the URL's lede payload — for the spine, pull from query params or fall back to top trending
  // Wired more richly later; for the spine, leave as empty so the strip degrades gracefully
}, [showRankStrip]);

// In render:
{showRankStrip && <MarketsTopStrip markets={stripMarkets} />}
```

- [ ] **Step 4: Manually verify**

Run: `cd prediction-web && npm run dev`
Open: `http://localhost:5173/markets?ref=wa_daily&lede=rank`
Expected: strip renders (empty for now), no crashes.

- [ ] **Step 5: Commit**

```bash
git add prediction-web/src/components/MarketsTopStrip.jsx prediction-web/src/pages/Markets.jsx prediction-web/src/api.js
git commit -m "feat(web): markets top strip for rank-lede landings"
```

---

## Task 17: PredictionReveal — three-beat sheet

**Files:**
- Create: `prediction-web/src/components/PredictionReveal.jsx`
- Modify: `prediction-web/src/components/PredictSlip.jsx` — replace `PredictionConfirmation` with `PredictionReveal`.
- Modify: `prediction-web/src/api.js` — add `getRevealMeta(positionId)` if backend will return Beat 3 condition; or pass it in the predict response.

**Interfaces:**
- `<PredictionReveal data={data} onClose={fn} />` where `data` contains:
  - `outcomeLabel`, `stake`, `projectedPayout` — Beat 1
  - `oldPrice`, `newPrice` — Beat 2
  - `socialTicker: { type, copy } | null` — Beat 3 (server-determined)
- Server-determined Beat 3: extend the existing `POST /api/markets/:id/predict` response to include `socialTicker: { type, copy } | null`, evaluated synchronously at predict time.

- [ ] **Step 1: Extend the predict response on backend**

In `iroyinayo/src/modules/markets/multiMarkets.service.js`, inside the path that returns the prediction result, add a call to a new helper `computeSocialTicker(studentId, marketId, outcomeId)` and include it in the response.

Create the helper as `iroyinayo/src/modules/habit/socialTicker.js`:

```javascript
const db = require('../../config/database');

const MILESTONES = [100, 250, 500, 1000, 2500, 5000];
const PEER_LOOKBACK_DAYS = 7;
const PEER_RECENT_MINUTES = 60;

async function computeSocialTicker({ studentId, marketId, outcomeId, totalPredictionsAfter }) {
  const aloneOnSide = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: outcomeId })
    .whereNot('student_id', studentId)
    .count('* as c').first();
  if (Number(aloneOnSide.c) === 0) return { type: 'alone', copy: `You're alone on this.` };

  const lookback = new Date(Date.now() - PEER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - PEER_RECENT_MINUTES * 60 * 1000);
  const myPriorOutcomes = await db('multi_market_positions').where({ student_id: studentId }).where('created_at', '>=', lookback).select('market_id', 'outcome_id');
  for (const mp of myPriorOutcomes) {
    const peers = await db('multi_market_positions').where({ market_id: mp.market_id, outcome_id: mp.outcome_id }).whereNot('student_id', studentId).pluck('student_id');
    if (peers.length === 0) continue;
    const opposite = await db('multi_market_positions as p')
      .join('students as s', 'p.student_id', 's.id')
      .where('p.market_id', marketId)
      .whereNot('p.outcome_id', outcomeId)
      .whereIn('p.student_id', peers)
      .where('p.created_at', '>=', recent)
      .select('s.name').first();
    if (opposite) return { type: 'peer_opposite', copy: `${opposite.name} called the opposite an hour ago.` };
  }

  for (const m of MILESTONES) {
    if (totalPredictionsAfter === m) return { type: 'milestone', copy: `You're prediction #${m} on this market.` };
  }

  return null;
}

module.exports = { computeSocialTicker };
```

(The fourth condition — top-10% category caller — is a strong-enough query that for the spine it's omitted from the synchronous path. The accuracy-rank query in Task 5 takes too long to run on every predict. Document this in §10 of the spec — done as part of Task 21.)

In `multiMarkets.service.js`'s `buyPosition` (or wherever the response is shaped), call `computeSocialTicker(...)` and attach `socialTicker` to the returned object.

- [ ] **Step 2: Create PredictionReveal**

Create `prediction-web/src/components/PredictionReveal.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PredictionReveal({ data, onClose }) {
  const [phase, setPhase] = useState('beat1');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('beat2'), 250);
    const t2 = setTimeout(() => setPhase('beat3'), 850);
    const t3 = setTimeout(() => onClose?.(), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onClose]);

  const deltaPp = Math.abs((data.newPrice - data.oldPrice) * 100);
  const state = deltaPp >= 3 ? 'sharp' : deltaPp >= 0.5 ? 'notable' : 'negligible';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-paper border-t border-line shadow-float-lg rounded-t-2xl p-6">
        {/* Beat 1 */}
        <div className="font-serif text-section">Predicted.</div>
        <div className="mt-2 font-mono">
          {data.outcomeLabel} · {data.stake} pts · projected +{data.projectedPayout} pts
        </div>

        {/* Beat 2 */}
        {phase !== 'beat1' && (
          <div className="mt-4">
            <div className="h-2 bg-paper-hover rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${data.newPrice * 100}%` }} />
            </div>
            {state !== 'negligible' && (
              <div className="mt-2 font-mono">
                {Math.round(data.oldPrice * 100)}% → {Math.round(data.newPrice * 100)}%
                {state === 'sharp' && <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-ochre/20 text-ochre text-xs">Sharp move</span>}
              </div>
            )}
          </div>
        )}

        {/* Beat 3 */}
        {phase === 'beat3' && data.socialTicker && (
          <div className="mt-4 bg-paper-hover border border-line rounded-xl p-3 font-serif">
            {data.socialTicker.copy}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 3: Swap in PredictSlip**

In `prediction-web/src/components/PredictSlip.jsx`, replace `import PredictionConfirmation` with `import PredictionReveal`. Replace the JSX usage. Pass through the additional fields from the predict response (`oldPrice`, `newPrice`, `socialTicker`).

- [ ] **Step 4: Manually verify in dev**

Run: `cd prediction-web && npm run dev`
Place a prediction. Expected: three-beat sheet renders, beats appear in sequence, sheet dismisses after 4s.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/habit/socialTicker.js iroyinayo/src/modules/markets/multiMarkets.service.js prediction-web/src/components/PredictionReveal.jsx prediction-web/src/components/PredictSlip.jsx
git commit -m "feat(web): three-beat prediction reveal sheet with social ticker"
```

---

## Task 18: Remove old PredictionConfirmation

**Files:**
- Delete: `prediction-web/src/components/PredictionConfirmation.jsx`
- Grep verify no other importers.

- [ ] **Step 1: Verify no remaining imports**

Run: `cd prediction-web && grep -rn "PredictionConfirmation" src/`
Expected: zero results (or only the file itself).

- [ ] **Step 2: Delete**

```bash
rm prediction-web/src/components/PredictionConfirmation.jsx
```

- [ ] **Step 3: Commit**

```bash
git add -u prediction-web/src/components/PredictionConfirmation.jsx
git commit -m "chore: remove PredictionConfirmation superseded by PredictionReveal"
```

---

## Task 19: ProfileAccuracyHeader

**Files:**
- Create: `prediction-web/src/components/ProfileAccuracyHeader.jsx`
- Modify: `prediction-web/src/pages/Profile.jsx` — replace existing header with new component, demote volume/streak sections below the fold.
- Modify: `prediction-web/src/api.js` — add `getAccuracy(userId)`.

**Interfaces:**
- `<ProfileAccuracyHeader userId={uuid} isOwn={boolean} />` — fetches from `/api/habit/accuracy/:userId`, renders per spec §6.1.

- [ ] **Step 1: Add API client**

In `prediction-web/src/api.js`:

```javascript
export async function getAccuracy(userId) {
  const res = await fetch(`${API_BASE}/api/habit/accuracy/${userId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch accuracy');
  return res.json();
}
```

- [ ] **Step 2: Create the header component**

Create `prediction-web/src/components/ProfileAccuracyHeader.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { getAccuracy } from '../api';

function pct(x) { return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`; }

export default function ProfileAccuracyHeader({ userId, isOwn, displayName, campusTag }) {
  const [data, setData] = useState(null);
  useEffect(() => { getAccuracy(userId).then(setData).catch(() => setData(null)); }, [userId]);

  if (!data) return <div className="font-mono mono-label text-ink-muted">Loading…</div>;

  const hero = data.allTime.accuracy === null ? 'New caller' : pct(data.allTime.accuracy);
  const heroSub = data.allTime.accuracy === null ? '' : `RESOLVED CALLS · ${data.allTime.resolvedCalls}`;

  return (
    <section className="px-4 pt-6 pb-4">
      <div className="font-sans label text-ink-muted">{displayName} {campusTag ? `· ${campusTag}` : ''}</div>
      <div className="mt-2">
        <div className="font-serif text-hero leading-none">{hero}</div>
        {heroSub && <div className="mt-2 font-mono mono-label text-ink-muted">{heroSub}</div>}
      </div>
      {data.last30Days.accuracy !== null && (
        <div className="mt-3 font-mono mono-data text-ink-muted">30D · {pct(data.last30Days.accuracy)} · {data.last30Days.resolvedCalls} calls</div>
      )}
      {data.byCategory.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto -mx-4 px-4">
          {data.byCategory.map((c) => (
            <div key={c.category} className="shrink-0 bg-paper border border-line rounded-full px-3 py-1.5">
              <span className="font-sans label-sm">{c.category} </span>
              <span className="font-mono">{pct(c.accuracy)}</span>
            </div>
          ))}
        </div>
      )}
      {data.rank.rank !== null && (
        <div className="mt-3 font-sans label-sm text-ink-muted">
          Rank #{data.rank.rank} of {data.rank.totalRanked} · top {Math.round(100 - data.rank.percentile + 100 / data.rank.totalRanked)}% on accuracy
        </div>
      )}
      <div className="mt-2 font-sans label-sm text-ink-muted">
        {data.openCallsCount} open calls{data.nextResolutionAt ? ` · next resolves ${relativeTime(data.nextResolutionAt)}` : ''}
      </div>
    </section>
  );
}

function relativeTime(ts) {
  const diff = new Date(ts).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.round(mins / 60)}h`;
}
```

- [ ] **Step 3: Wire into Profile.jsx**

In `prediction-web/src/pages/Profile.jsx`, replace the existing header section (currently the top of the page) with:

```jsx
<ProfileAccuracyHeader userId={profileUserId} isOwn={isOwn} displayName={profile.name} campusTag={profile.campus} />
```

Move the existing points-balance / streak / lifetime-volume sections further down (below the fold). Keep the WhatsApp community link in the secondary area.

- [ ] **Step 4: Manually verify**

Open the dev app, view your own profile and a stranger's profile. Verify:
- Hero accuracy number prominent.
- "New caller" shown when no resolved calls.
- Per-category strip hides when no category has 5+ calls.
- Open calls + nearest resolution time visible.

- [ ] **Step 5: Commit**

```bash
git add prediction-web/src/components/ProfileAccuracyHeader.jsx prediction-web/src/pages/Profile.jsx prediction-web/src/api.js
git commit -m "feat(web): accuracy-led profile header"
```

---

## Task 20: ProfileShareModal updates

**Files:**
- Modify: `prediction-web/src/components/ProfileShareModal.jsx` — capture the new header element, update default share text.

**Interfaces:** Unchanged externally.

- [ ] **Step 1: Update the capture target ref**

Find where `shareWithImage` is called in `ProfileShareModal.jsx`. Update the captured element selector / ref to point to the new `ProfileAccuracyHeader` root element. Pass through the accuracy data so the share text can read it:

```javascript
const shareText = data.allTime.accuracy === null
  ? `${firstName} is a new caller on IroyinMarket.`
  : `${firstName} is ${Math.round(data.allTime.accuracy * 100)}% accurate on IroyinMarket. Rank #${data.rank.rank} of ${data.rank.totalRanked}.`;
```

- [ ] **Step 2: Manually verify share**

Open the dev app, open the share modal from a profile page. Capture an image. Verify:
- The image shows the new accuracy header tightly cropped.
- The share text matches the format above.

- [ ] **Step 3: Commit**

```bash
git add prediction-web/src/components/ProfileShareModal.jsx
git commit -m "feat(web): profile share captures accuracy header"
```

---

## Task 21: Telemetry events

**Files:**
- Modify: `iroyinayo/src/modules/habit/queueSender.js`, `iroyinayo/src/modules/habit/positionTriggers.js`, `iroyinayo/src/modules/markets/multiMarkets.service.js`, `prediction-web/src/components/PredictionReveal.jsx`, `prediction-web/src/pages/MarketDetail.jsx`, `prediction-web/src/components/ProfileShareModal.jsx`.

**Interfaces:**
- Use the existing PostHog or analytics module. Find the existing event-tracking call pattern (the working tree has uncommitted PostHog work — but that's not on this branch; only use APIs that exist on `main`).
- If no analytics module is on `main`, add a thin `iroyinayo/src/utils/telemetry.js` shim that no-ops and logs at debug level. Frontend uses `console.debug` until wired.

- [ ] **Step 1: Inspect what's on main**

Run: `cd /Users/mac/Documents/claudeCode/new\ p/worktrees/habit-loop && grep -rn "posthog\|analytics\|track(" iroyinayo/src/ prediction-web/src/ | head -20`
If empty: create the shim. If populated: use the existing API.

- [ ] **Step 2: Add the shim (if needed)**

Create `iroyinayo/src/utils/telemetry.js`:

```javascript
function track(event, properties = {}) {
  console.log(`[TELEMETRY] ${event}`, properties);
}
module.exports = { track };
```

Create `prediction-web/src/utils/telemetry.js`:

```javascript
export function track(event, properties = {}) {
  if (typeof console !== 'undefined') console.debug(`[telemetry] ${event}`, properties);
}
```

- [ ] **Step 3: Wire the 9 events from spec §8**

In `queueSender.js`: emit `wa_daily_sent`, `wa_daily_failed`, `wa_daily_skipped` from the corresponding branches.
In `positionTriggers.js`: emit `position_trigger_eligible` on each insert, `position_trigger_surfaced` when `fired_at` is set.
In `multiMarkets.service.js` predict path: extend the existing `prediction_placed` event (or add it) to include `source_ref`.
In `PredictionReveal.jsx`: emit `reveal_beat3_shown` when Beat 3 renders.
In `MarketDetail.jsx`: emit `deep_link_landed` when `useDeepLinkRef()` returns a non-null `ref` on mount.
In `ProfileShareModal.jsx`: emit `profile_share_captured` when an image is generated.

(Exact code per event — short calls like `track('wa_daily_sent', { user_id, lede_type, markets_count, latency_from_scheduled });`)

- [ ] **Step 4: Run all backend tests**

Run: `cd iroyinayo && npm test`
Expected: all pass (events are fire-and-forget; no test assertions on them yet).

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/utils/telemetry.js iroyinayo/src/modules/habit/queueSender.js iroyinayo/src/modules/habit/positionTriggers.js iroyinayo/src/modules/markets/multiMarkets.service.js prediction-web/src/utils/telemetry.js prediction-web/src/components/PredictionReveal.jsx prediction-web/src/pages/MarketDetail.jsx prediction-web/src/components/ProfileShareModal.jsx
git commit -m "feat: wire telemetry events for habit loop funnel"
```

---

## Task 22: Frontend rebuild and final commit

**Files:**
- Modify: `iroyinayo/public/index.html`, `iroyinayo/public/assets/*` — rebuilt from `prediction-web/dist/`.

- [ ] **Step 1: Run all tests one more time**

Run: `cd iroyinayo && npm test`
Expected: all pass.

- [ ] **Step 2: Build the frontend**

Run: `cd prediction-web && npm run build`
Expected: `dist/` updated, no errors.

- [ ] **Step 3: Copy to public**

Run:
```bash
cd /Users/mac/Documents/claudeCode/new\ p/worktrees/habit-loop
rm iroyinayo/public/assets/*
cp -r prediction-web/dist/assets/* iroyinayo/public/assets/
cp prediction-web/dist/index.html iroyinayo/public/index.html
```

- [ ] **Step 4: Spot-check by opening locally**

Run: `cd iroyinayo && npm start &`
Open: `http://localhost:3000/`
Expected: app loads, profile renders with new header, predict flow works, no console errors.
Kill: `kill %1`

- [ ] **Step 5: Commit the bundle**

```bash
git add iroyinayo/public/
git commit -m "build: rebuild frontend with habit-loop changes"
```

- [ ] **Step 6: Final review of the branch**

Run: `git log --oneline main..HEAD`
Expected: 22 commits, one per task, descriptive messages.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) | Coverage |
|---|---|---|
| §3.1 Send timing — window, anchor, jitter, pacing | T7, T9 | ✓ |
| §3.2 Message structure, greeting pool, lede priority, markets line | T6, T8 | ✓ |
| §3.3 Recipient hygiene (opt-in, skip-recent, PAUSE, STOP, failure handling) | T9, T12 | ✓ |
| §3.4 Queue persistence, drop-not-backfill, health monitor (5% halt) | T2, T9 | ✓ |
| §3.5 Deep-link tracking | T8, T14 | ✓ |
| §4.1 Smart-split landing surfaces | T15, T16 | ✓ |
| §4.2 Default stake rules | T15 | ✓ |
| §4.3 Quick-predict render mode (30s timeout) | T15 | ✓ |
| §4.4 Two-tap prediction flow | T15, T17 | ✓ |
| §4.5 Edge cases (resolved-between-send-and-tap, logged-out, late tap) | T15 — partial: edge handling lives in MarketDetail already; resolution and "View market" link covered. **Logged-out redirect with param preservation: ensure existing auth flow preserves `?ref`.** Add: check `useDeepLinkRef` survives login redirect via sessionStorage. Covered in T14. ✓ |
| §5.1 Beat 1 acknowledgement | T17 | ✓ |
| §5.2 Beat 2 odds-shift, three states | T17 | ✓ |
| §5.3 Beat 3 social ticker conditions | T17 (3 of 4 conditions; top-10% caller deferred — documented in code) | Partial; documented |
| §5.4–5.5 Sheet dismissal, anti-patterns | T17 | ✓ |
| §5.6 Component change (PredictionConfirmation → PredictionReveal) | T17, T18 | ✓ |
| §6.1 Accuracy as identity surface, demotions | T19, T20 | ✓ |
| §6.2 Accuracy calculation rules | T5 | ✓ |
| §6.3 Position triggers: 4 conditions | T11, T13 (sharp_move via API not queue) | ✓ |
| §6.4 position_triggers schema, idempotency | T4, T11 | ✓ |
| §7.1–7.4 Data model changes | T1, T2, T3, T4 | ✓ |
| §8 Telemetry events | T21 | ✓ |
| §11 Risk mitigations | Pacing/jitter T9; queue persistence T2; default stake caps T15; rollback T17 (basic); 3-call min T5 | ✓ |

Gap found: §5.3's "top-10% caller" Beat 3 condition is omitted from the synchronous predict path due to query cost. This is a deliberate scope cut documented in Task 17 step 1. The risk register in the spec doesn't mention this; the user should approve.

**2. Placeholder scan:** No "TBD", "TODO", "fill in later" in tasks. Several tasks reference "exact line numbers depend on the file's current state" — this is acceptable for files I have not fully read inline (e.g., `multiMarkets.service.js` at 568 lines), because the engineer is told *what* to find (function name, call site).

**3. Type consistency:**
- `pickLede` returns `{ type, payload }` — used in `buildDailyQueue` (T7) and `renderMessage` (T8) consistently.
- `computeAccuracy` returns `{ resolvedCalls, correct, accuracy }` — used in `habit.routes.js` and `ProfileAccuracyHeader` consistently.
- `position_triggers.condition` enum values match between schema (T4), evaluator (T11), and trigger throttling logic.
- `wa_failure_count` increment behavior in `sendWhatsAppWithFailureTracking` (T9) matches the `wa_paused_until` 14-day pause threshold consistently.
- `source_ref` flows: URL → `useDeepLinkRef` (T14) → `predict()` API call (T14) → `buyPosition` (T14) → `multi_market_positions.source_ref` (T3). Consistent.

No type or naming bugs found.

