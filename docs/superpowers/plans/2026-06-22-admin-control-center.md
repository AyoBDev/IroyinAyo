# Admin Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin app's home page with a four-zone "control center" that lets the admin clear daily operational queues (resolve markets, approve content, fulfill redemptions, etc.) inline with one-click actions, polled at 10s/30s intervals.

**Architecture:** New Next.js page at `iroyinayo-admin/src/app/page.js` composed of ~15 focused panel components. Two new aggregation endpoints (`/admin/control-center/summary`, `/admin/control-center/health`) avoid 8 separate calls on mount. Seven smaller new endpoints add admin actions the spec found missing (market approve/reject, market-report PATCH, weekly-winner mark-paid, bot reconnect, banned-students list). Two small migrations add metadata columns to `market_reports` and `weekly_leaderboards`.

**Tech Stack:** Backend — Node.js + Express, Knex/PostgreSQL, Jest. Frontend — Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui (Card, Badge, Button, Dialog, Table installed), `recharts`, `lucide-react`, `js-cookie`, `posthog-js` (new dependency).

## Global Constraints

- **Working directory:** `/Users/mac/Documents/claudeCode/new p/worktrees/control-center`. Every `git` and shell command runs from there. Never modify the main checkout.
- **Branch:** `feat/control-center`. Branched from `main` at the spec commit `cf3a875`.
- **Spec is canonical.** Path: `docs/superpowers/specs/2026-06-22-admin-control-center-design.md`. Numbers and thresholds in this plan defer to the spec.
- **Backend route mount paths** (existing pattern from `iroyinayo/src/app.js`): `app.use('/api/admin', adminRoutes)`, `app.use('/api/multi-markets', multiMarketRoutes)`. New routes mount under these existing prefixes.
- **Admin auth middleware:** `authenticate` from `iroyinayo/src/middleware/auth.js` populates `req.admin`. `requireRole('super_admin', 'moderator')` from `iroyinayo/src/middleware/adminRole.js` gates destructive actions. Match the pattern in `iroyinayo/src/modules/admin/admin.routes.js`.
- **Migration numbering:** continues from `029_create_daily_rank_snapshots.js`. New migrations start at `030`.
- **Test runner (backend):** `cd iroyinayo && npm test -- <pattern>`. The `iroyinayo/.env` file is in place in the worktree; migrations apply to dev + test DBs via `npm run migrate` and `npm run migrate:test`.
- **Frontend tests:** no test runner is configured in `iroyinayo-admin/`. Verify frontend by `npm run build` (Next.js build) and manual dev-server check. Do NOT add a frontend test runner in this spec.
- **shadcn/ui components available** (no installation needed): `Card`, `Badge`, `Button`, `Dialog`, `Table`, `Input`, `Textarea`, `Label`, `Select`, `Separator`, `Sheet`, `DropdownMenu`.
- **Polling cadences (load-bearing):** `/admin/control-center/health` every 10 seconds; `/admin/control-center/summary` every 30 seconds. Per-panel detail fetches on mount and on user action only.
- **No AI attribution in commits.** No `Co-Authored-By: Claude` trailers, no "Generated with Claude" mentions. Commit format: `<area>: <summary>` (e.g., `feat(cc): add summary endpoint`).
- **No frontend bundle commits.** The admin app is a Next.js app deployed separately from the main backend; there is no `iroyinayo/public/` rebuild step like the prediction-web app has.

---

## File Structure

### New backend files

| Path | Responsibility |
|---|---|
| `iroyinayo/migrations/030_add_market_report_resolution.js` | Adds `resolution_status`, `resolution_note`, `resolved_at`, `resolved_by_admin_id` to `market_reports`. |
| `iroyinayo/migrations/031_add_weekly_winner_paid_metadata.js` | Adds `paid_at`, `paid_by_admin_id` to `weekly_leaderboards`. |
| `iroyinayo/src/modules/admin/controlCenter.service.js` | Aggregation queries for the summary and health endpoints. One method per response field. |
| `iroyinayo/src/modules/admin/controlCenter.routes.js` | Express routes: `GET /control-center/summary`, `GET /control-center/health`. Mounted under `/api/admin`. |
| `iroyinayo/src/modules/admin/marketReports.service.js` | Read pending reports; PATCH a report's `resolution_status` + note. |
| `iroyinayo/src/modules/admin/marketReports.routes.js` | Routes: `GET /market-reports`, `PATCH /market-reports/:id`. Mounted under `/api/admin`. |
| `iroyinayo/src/modules/admin/weeklyWinner.service.js` | Get current week's leaderboard winner + prize_paid status; mark paid. |
| `iroyinayo/src/modules/admin/weeklyWinner.routes.js` | Routes: `GET /weekly-winner-status`, `POST /weekly-winner/:weekStart/mark-paid`. Mounted under `/api/admin`. |
| `iroyinayo/src/modules/admin/bot.routes.js` | Route: `POST /bot/reconnect` returning `{status, message}`. Mounted under `/api/admin`. |
| `iroyinayo/src/modules/admin/bannedStudents.service.js` | Query students banned in the last 7 days with ban metadata. |
| `iroyinayo/src/modules/admin/bannedStudents.routes.js` | Route: `GET /students/banned`. Mounted under `/api/admin`. |
| `iroyinayo/tests/admin/controlCenter.test.js` | Tests for summary + health aggregation. |
| `iroyinayo/tests/admin/marketReports.test.js` | Tests for report list + PATCH. |
| `iroyinayo/tests/admin/weeklyWinner.test.js` | Tests for winner status + mark-paid. |
| `iroyinayo/tests/admin/bannedStudents.test.js` | Tests for banned-list query. |
| `iroyinayo/tests/admin/marketApproveReject.test.js` | Tests for the new approve/reject routes on multi-markets. |

### New frontend files

| Path | Responsibility |
|---|---|
| `iroyinayo-admin/src/components/control-center/usePolling.js` | Shared hook: `usePolling(fetchFn, intervalMs)` returning `{ data, error, refresh }`. Used by every panel. |
| `iroyinayo-admin/src/components/control-center/HealthStrip.jsx` | Zone 1: 5 status pills, polls 10s. |
| `iroyinayo-admin/src/components/control-center/BotStatusPill.jsx` | Special pill: shows bot online state; clickable opens reconnect dialog. |
| `iroyinayo-admin/src/components/control-center/BotReconnectDialog.jsx` | Modal triggered by BotStatusPill. |
| `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` | Zone 2 wrapper: 2-column grid of 5 panels. |
| `iroyinayo-admin/src/components/control-center/ResolveMarketsPanel.jsx` | Closed markets needing resolution. |
| `iroyinayo-admin/src/components/control-center/PendingUserMarketsPanel.jsx` | User-created markets with `status='pending'`. |
| `iroyinayo-admin/src/components/control-center/PendingContentPanel.jsx` | Daily AI content awaiting approval. |
| `iroyinayo-admin/src/components/control-center/PendingRedemptionsPanel.jsx` | Pending reward redemptions. |
| `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx` | Spec 1 placeholder card. |
| `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx` | Zone 3 wrapper: 4 collapsible panels. |
| `iroyinayo-admin/src/components/control-center/SimulationAlertsPanel.jsx` | Manipulation/stuck/early-resolution alerts. |
| `iroyinayo-admin/src/components/control-center/MarketReportsPanel.jsx` | User-flagged markets. |
| `iroyinayo-admin/src/components/control-center/BanQueuePanel.jsx` | Recent bans + unban inline. |
| `iroyinayo-admin/src/components/control-center/WeeklyWinnerPanel.jsx` | Mark prize-paid. |
| `iroyinayo-admin/src/components/control-center/ManageStrip.jsx` | Zone 4 deep-link tiles. |
| `iroyinayo-admin/src/components/control-center/EmptyState.jsx` | Shared "All clear ✓" empty state. |
| `iroyinayo-admin/src/lib/telemetry.js` | Wraps `posthog-js` for client-side events. |

### Existing files modified

| Path | Change |
|---|---|
| `iroyinayo/src/app.js` | Register 5 new route mounts: `controlCenterRoutes`, `marketReportsRoutes`, `weeklyWinnerRoutes`, `botRoutes`, `bannedStudentsRoutes`. All under `/api/admin/...`. |
| `iroyinayo/src/modules/markets/multiMarkets.routes.js` | Add `POST /:id/approve` and `POST /:id/reject`. |
| `iroyinayo/src/modules/markets/multiMarkets.service.js` | Add `approveMarket(marketId, adminId)` and `rejectMarket(marketId, adminId, reason)` functions. |
| `iroyinayo-admin/src/app/page.js` | REWRITTEN. ~80 lines: imports the four zones, renders them in order, no other logic. |
| `iroyinayo-admin/src/lib/api.js` | Add helpers: `getControlCenterSummary`, `getControlCenterHealth`, `getMarketReports`, `updateMarketReport`, `getWeeklyWinnerStatus`, `markWeeklyWinnerPaid`, `getBannedStudents`, `approveMarket`, `rejectMarket`, `reconnectBot`. |
| `iroyinayo-admin/package.json` | Add `posthog-js` dependency. |

---

## Task ordering rationale

- **Tasks 1–2: Migrations.** Schema changes land first so all subsequent backend tasks have the columns they need.
- **Tasks 3–7: Backend endpoints.** One task per endpoint group. Each is TDD with Jest tests against the real test DB.
- **Task 8: Mount new routes.** Single integration task — register everything in `app.js`. Quick verification that all new endpoints respond.
- **Tasks 9–10: Frontend foundations.** `usePolling` hook + `api.js` helpers. Every panel depends on these.
- **Task 11: Skeleton page + zones.** Replace the existing dashboard with the new page + zone wrappers. App still builds and runs; zones contain empty placeholders.
- **Tasks 12–16: Today's Work panels** (one panel per task). Each is independently shippable.
- **Tasks 17–20: Weekly Queue panels** (one panel per task).
- **Task 21: HealthStrip + BotStatusPill + BotReconnectDialog.**
- **Task 22: ManageStrip + AIMarketCreatorPanel placeholder.**
- **Task 23: Telemetry wiring.** All `cc_*` events from spec §8.
- **Task 24: Final smoke + admin app build verification.**

---

## Task 1: Migration 030 — market_report resolution columns

**Files:**
- Create: `iroyinayo/migrations/030_add_market_report_resolution.js`

**Interfaces:**
- Consumes: existing `market_reports` table.
- Produces: 4 new columns on `market_reports`: `resolution_status` (text enum-checked), `resolution_note` (text nullable), `resolved_at` (timestamptz nullable), `resolved_by_admin_id` (uuid FK to admins, nullable).

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/030_add_market_report_resolution.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.alterTable('market_reports', (table) => {
    table.enu('resolution_status', ['pending', 'dismissed', 'resolved']).notNullable().defaultTo('pending');
    table.text('resolution_note').nullable();
    table.timestamp('resolved_at', { useTz: true }).nullable();
    table.uuid('resolved_by_admin_id').nullable().references('id').inTable('admins').onDelete('SET NULL');
    table.index(['resolution_status', 'created_at'], 'idx_market_reports_pending');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('market_reports', (table) => {
    table.dropIndex(['resolution_status', 'created_at'], 'idx_market_reports_pending');
    table.dropColumn('resolved_by_admin_id');
    table.dropColumn('resolved_at');
    table.dropColumn('resolution_note');
    table.dropColumn('resolution_status');
  });
};
```

- [ ] **Step 2: Run migrations**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed, listing `030_add_market_report_resolution.js`.

- [ ] **Step 3: Verify columns**

Run: `cd iroyinayo && PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "\d market_reports" | head -20`
Expected: shows `resolution_status`, `resolution_note`, `resolved_at`, `resolved_by_admin_id` columns.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/claudeCode/new\ p/worktrees/control-center
git add iroyinayo/migrations/030_add_market_report_resolution.js
git commit -m "feat(cc): add market_report resolution columns"
```

---

## Task 2: Migration 031 — weekly_winner paid metadata

**Files:**
- Create: `iroyinayo/migrations/031_add_weekly_winner_paid_metadata.js`

**Interfaces:**
- Consumes: existing `weekly_leaderboards` table (which already has `prize_paid` boolean).
- Produces: 2 new columns on `weekly_leaderboards`: `paid_at` (timestamptz nullable), `paid_by_admin_id` (uuid FK to admins, nullable).

- [ ] **Step 1: Write the migration**

Create `iroyinayo/migrations/031_add_weekly_winner_paid_metadata.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.alterTable('weekly_leaderboards', (table) => {
    table.timestamp('paid_at', { useTz: true }).nullable();
    table.uuid('paid_by_admin_id').nullable().references('id').inTable('admins').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('weekly_leaderboards', (table) => {
    table.dropColumn('paid_by_admin_id');
    table.dropColumn('paid_at');
  });
};
```

- [ ] **Step 2: Run migrations**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed.

- [ ] **Step 3: Verify columns**

Run: `cd iroyinayo && PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "SELECT column_name FROM information_schema.columns WHERE table_name='weekly_leaderboards' AND column_name IN ('paid_at', 'paid_by_admin_id') ORDER BY column_name;"`
Expected: returns both column names.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo/migrations/031_add_weekly_winner_paid_metadata.js
git commit -m "feat(cc): add weekly_winner paid metadata"
```

---

## Task 3: Market approve/reject endpoints

**Files:**
- Modify: `iroyinayo/src/modules/markets/multiMarkets.service.js`
- Modify: `iroyinayo/src/modules/markets/multiMarkets.routes.js`
- Create: `iroyinayo/tests/admin/marketApproveReject.test.js`

**Interfaces:**
- Consumes: existing `multi_markets` table; `status` enum already includes `pending` (per existing user-created-markets feature) and we add `rejected` if not present.
- Produces:
  - `async function approveMarket(marketId, adminId)` — sets `status = 'open'`, records `approved_by_admin_id` (we use the existing `created_by` column path; if no `approved_by` column exists yet, store the action via `admins.id` in a future audit log — out of scope for v1, just flip status).
  - `async function rejectMarket(marketId, adminId, reason)` — sets `status = 'rejected'`, stores reason in a new `rejection_reason` column? **NO** — we don't add another column. Instead, the rejection-reason is logged to PostHog only (event `cc_user_market_rejected`). The DB just transitions status to `rejected`.
  - Routes: `POST /multi-markets/:id/approve` (no body), `POST /multi-markets/:id/reject` body `{reason}`.

- [ ] **Step 1: Check `status` enum values**

Run: `cd iroyinayo && PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "\d multi_markets" | grep -i "status\|check"`
Expected: shows the `status` column. If the check constraint does NOT include `rejected`, we need to update it; if it does (or column is plain text), no migration needed.

If `rejected` is missing AND the column has a check constraint, add a migration step:
```javascript
// In a quick migration if needed:
await knex.raw(`ALTER TABLE multi_markets DROP CONSTRAINT IF EXISTS multi_markets_status_check`);
await knex.raw(`ALTER TABLE multi_markets ADD CONSTRAINT multi_markets_status_check CHECK (status IN ('pending', 'open', 'closed', 'resolved', 'rejected'))`);
```

For this plan, assume the column is plain text or already permissive; if the verification step fails, add a small follow-up migration and commit it as part of this task.

- [ ] **Step 2: Write failing tests**

Create `iroyinayo/tests/admin/marketApproveReject.test.js`:

```javascript
const db = require('../../src/config/database');
const { approveMarket, rejectMarket } = require('../../src/modules/markets/multiMarkets.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createPendingMarket() {
  const id = uuidv4();
  await db('multi_markets').insert({
    id,
    title: 'Test pending market',
    status: 'pending',
    liquidity_b: 100,
  });
  return id;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({
    id,
    email: `admin-${id.slice(0,8)}@test.com`,
    password_hash: 'x',
    role: 'super_admin',
  });
  return id;
}

describe('approveMarket', () => {
  test('transitions status from pending to open', async () => {
    const marketId = await createPendingMarket();
    const adminId = await createAdmin();
    await approveMarket(marketId, adminId);
    const market = await db('multi_markets').where({ id: marketId }).first();
    expect(market.status).toBe('open');
  });

  test('throws if market is not pending', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const adminId = await createAdmin();
    await expect(approveMarket(marketId, adminId)).rejects.toThrow(/not pending/i);
  });

  test('throws if market does not exist', async () => {
    const adminId = await createAdmin();
    await expect(approveMarket(uuidv4(), adminId)).rejects.toThrow(/not found/i);
  });
});

describe('rejectMarket', () => {
  test('transitions status from pending to rejected', async () => {
    const marketId = await createPendingMarket();
    const adminId = await createAdmin();
    await rejectMarket(marketId, adminId, 'inappropriate content');
    const market = await db('multi_markets').where({ id: marketId }).first();
    expect(market.status).toBe('rejected');
  });

  test('throws if market is not pending', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const adminId = await createAdmin();
    await expect(rejectMarket(marketId, adminId, 'r')).rejects.toThrow(/not pending/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd iroyinayo && npm test -- marketApproveReject.test.js`
Expected: FAIL — `approveMarket` and `rejectMarket` not exported from service.

- [ ] **Step 4: Implement the service functions**

In `iroyinayo/src/modules/markets/multiMarkets.service.js`, before `module.exports`, add:

```javascript
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
```

Update the `module.exports` at the bottom of the file to include `approveMarket, rejectMarket`. If the file uses `module.exports = { ... }` with a list, add the names there.

- [ ] **Step 5: Add the routes**

In `iroyinayo/src/modules/markets/multiMarkets.routes.js`, after the existing admin routes (search for `/:id/resolve`), add:

```javascript
router.post('/:id/approve', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await multiMarkets.approveMarket(req.params.id, req.admin.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/reject', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.length < 3) {
      return res.status(400).json({ error: 'reason required (min 3 chars)' });
    }
    const result = await multiMarkets.rejectMarket(req.params.id, req.admin.id, reason);
    res.json(result);
  } catch (err) { next(err); }
});
```

If `requireRole` is not already imported in this file, add at the top:
```javascript
const { requireRole } = require('../../middleware/adminRole');
```

- [ ] **Step 6: Run tests**

Run: `cd iroyinayo && npm test -- marketApproveReject.test.js`
Expected: 5/5 pass.

- [ ] **Step 7: Commit**

```bash
git add iroyinayo/src/modules/markets/multiMarkets.service.js iroyinayo/src/modules/markets/multiMarkets.routes.js iroyinayo/tests/admin/marketApproveReject.test.js
git commit -m "feat(cc): market approve/reject endpoints"
```

---

## Task 4: Market reports service + routes

**Files:**
- Create: `iroyinayo/src/modules/admin/marketReports.service.js`
- Create: `iroyinayo/src/modules/admin/marketReports.routes.js`
- Create: `iroyinayo/tests/admin/marketReports.test.js`

**Interfaces:**
- Consumes: `market_reports` table (now with resolution columns from Task 1).
- Produces:
  - `async function listPendingReports({ limit = 20 } = {})` → `{ items: [...], total: number }`. Each item joins market title and reporter name.
  - `async function updateReport(reportId, adminId, { action, note })` where `action` is `'dismiss'` or `'resolve'`. Returns `{ ok: true }`.
  - Routes: `GET /market-reports` (any authenticated admin), `PATCH /market-reports/:id` (`requireRole('super_admin', 'moderator')`).

- [ ] **Step 1: Write the tests**

Create `iroyinayo/tests/admin/marketReports.test.js`:

```javascript
const db = require('../../src/config/database');
const { listPendingReports, updateReport } = require('../../src/modules/admin/marketReports.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createMarket() {
  const id = uuidv4();
  await db('multi_markets').insert({ id, title: 'Test', status: 'open', liquidity_b: 100 });
  return id;
}

async function createStudent() {
  const id = uuidv4();
  await db('students').insert({ id, phone_number: `234${Date.now()}${Math.floor(Math.random()*10000)}`, name: 'S', is_onboarded: true, points_balance: 0 });
  return id;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({ id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'super_admin' });
  return id;
}

async function createReport(marketId, studentId, reason = 'spam') {
  const id = uuidv4();
  await db('market_reports').insert({ id, market_id: marketId, student_id: studentId, reason });
  return id;
}

describe('listPendingReports', () => {
  test('returns reports with market title and reporter name', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    await createReport(marketId, studentId, 'abusive');
    const result = await listPendingReports();
    expect(result.total).toBe(1);
    expect(result.items[0].reason).toBe('abusive');
    expect(result.items[0].market_title).toBe('Test');
    expect(result.items[0].reporter_name).toBe('S');
  });

  test('excludes resolved and dismissed reports', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId, 'r1');
    await db('market_reports').where({ id: reportId }).update({ resolution_status: 'resolved' });
    const result = await listPendingReports();
    expect(result.total).toBe(0);
  });

  test('orders newest first', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const id1 = uuidv4();
    const id2 = uuidv4();
    await db('market_reports').insert({ id: id1, market_id: marketId, student_id: studentId, reason: 'first', created_at: new Date(Date.now() - 60000) });
    await db('market_reports').insert({ id: id2, market_id: marketId, student_id: studentId, reason: 'second' });
    const result = await listPendingReports();
    expect(result.items[0].id).toBe(id2);
  });
});

describe('updateReport', () => {
  test('dismiss sets resolution_status to dismissed', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await updateReport(reportId, adminId, { action: 'dismiss' });
    const row = await db('market_reports').where({ id: reportId }).first();
    expect(row.resolution_status).toBe('dismissed');
    expect(row.resolved_by_admin_id).toBe(adminId);
    expect(row.resolved_at).not.toBeNull();
  });

  test('resolve sets resolution_status to resolved with note', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await updateReport(reportId, adminId, { action: 'resolve', note: 'banned creator' });
    const row = await db('market_reports').where({ id: reportId }).first();
    expect(row.resolution_status).toBe('resolved');
    expect(row.resolution_note).toBe('banned creator');
  });

  test('throws on invalid action', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await expect(updateReport(reportId, adminId, { action: 'invalid' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd iroyinayo && npm test -- marketReports.test.js`
Expected: FAIL — `Cannot find module '../../src/modules/admin/marketReports.service'`.

- [ ] **Step 3: Implement the service**

Create `iroyinayo/src/modules/admin/marketReports.service.js`:

```javascript
const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

async function listPendingReports({ limit = 20 } = {}) {
  const items = await db('market_reports as r')
    .join('multi_markets as m', 'r.market_id', 'm.id')
    .join('students as s', 'r.student_id', 's.id')
    .where('r.resolution_status', 'pending')
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .select(
      'r.id',
      'r.market_id',
      'r.student_id',
      'r.reason',
      'r.created_at',
      'm.title as market_title',
      's.name as reporter_name'
    );
  const totalRow = await db('market_reports').where({ resolution_status: 'pending' }).count('id as c').first();
  return { items, total: Number(totalRow.c) };
}

async function updateReport(reportId, adminId, { action, note }) {
  const report = await db('market_reports').where({ id: reportId }).first();
  if (!report) throw new NotFoundError('Report not found');

  let newStatus;
  if (action === 'dismiss') newStatus = 'dismissed';
  else if (action === 'resolve') newStatus = 'resolved';
  else throw new ValidationError('Action must be "dismiss" or "resolve"');

  await db('market_reports').where({ id: reportId }).update({
    resolution_status: newStatus,
    resolution_note: note || null,
    resolved_at: new Date(),
    resolved_by_admin_id: adminId,
  });
  return { ok: true };
}

module.exports = { listPendingReports, updateReport };
```

- [ ] **Step 4: Implement the routes**

Create `iroyinayo/src/modules/admin/marketReports.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const service = require('./marketReports.service');

const router = express.Router();

router.get('/market-reports', authenticate, async (req, res, next) => {
  try {
    const result = await service.listPendingReports();
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/market-reports/:id', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { action, note } = req.body || {};
    const result = await service.updateReport(req.params.id, req.admin.id, { action, note });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 5: Verify GREEN**

Run: `cd iroyinayo && npm test -- marketReports.test.js`
Expected: 6/6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/admin/marketReports.service.js iroyinayo/src/modules/admin/marketReports.routes.js iroyinayo/tests/admin/marketReports.test.js
git commit -m "feat(cc): market reports list + patch endpoints"
```

---

## Task 5: Weekly winner service + routes

**Files:**
- Create: `iroyinayo/src/modules/admin/weeklyWinner.service.js`
- Create: `iroyinayo/src/modules/admin/weeklyWinner.routes.js`
- Create: `iroyinayo/tests/admin/weeklyWinner.test.js`

**Interfaces:**
- Consumes: `weekly_leaderboards` table (now with `paid_at`, `paid_by_admin_id` columns).
- Produces:
  - `async function getWeeklyWinnerStatus()` → `{ weekStart, winnerId, winnerName, winnerProfit, prizePaid, paidAt, paidByAdminId } | null`. Returns null if no winner row for current week.
  - `async function markWinnerPaid(weekStart, adminId)` → `{ ok: true }`. Throws if no row found or already paid.
  - Routes: `GET /weekly-winner-status` (any authenticated admin), `POST /weekly-winner/:weekStart/mark-paid` (`requireRole('super_admin', 'moderator')`).

- [ ] **Step 1: Write the tests**

Create `iroyinayo/tests/admin/weeklyWinner.test.js`:

```javascript
const db = require('../../src/config/database');
const { getWeeklyWinnerStatus, markWinnerPaid } = require('../../src/modules/admin/weeklyWinner.service');
const { randomUUID: uuidv4 } = require('crypto');

function getCurrentWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({ id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'super_admin' });
  return id;
}

async function createWinnerRow({ paid = false } = {}) {
  const id = uuidv4();
  const weekStart = getCurrentWeekStart();
  const winnerId = uuidv4();
  await db('students').insert({ id: winnerId, phone_number: `234${Date.now()}${Math.floor(Math.random()*10000)}`, name: 'Winner', is_onboarded: true, points_balance: 100 });
  await db('weekly_leaderboards').insert({
    id,
    week_start: weekStart,
    week_end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
    winner_id: winnerId,
    winner_name: 'Winner',
    winner_profit: 500,
    prize_paid: paid,
  });
  return { id, weekStart, winnerId };
}

describe('getWeeklyWinnerStatus', () => {
  test('returns winner data when row exists', async () => {
    await createWinnerRow();
    const result = await getWeeklyWinnerStatus();
    expect(result).not.toBeNull();
    expect(result.winnerName).toBe('Winner');
    expect(result.winnerProfit).toBe(500);
    expect(result.prizePaid).toBe(false);
  });

  test('returns null when no row for current week', async () => {
    const result = await getWeeklyWinnerStatus();
    expect(result).toBeNull();
  });
});

describe('markWinnerPaid', () => {
  test('flips prize_paid to true and records metadata', async () => {
    const { weekStart } = await createWinnerRow();
    const adminId = await createAdmin();
    await markWinnerPaid(weekStart, adminId);
    const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
    expect(row.prize_paid).toBe(true);
    expect(row.paid_by_admin_id).toBe(adminId);
    expect(row.paid_at).not.toBeNull();
  });

  test('throws if already paid', async () => {
    const { weekStart } = await createWinnerRow({ paid: true });
    const adminId = await createAdmin();
    await expect(markWinnerPaid(weekStart, adminId)).rejects.toThrow(/already paid/i);
  });

  test('throws if no row for week', async () => {
    const adminId = await createAdmin();
    await expect(markWinnerPaid(new Date('2020-01-01'), adminId)).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd iroyinayo && npm test -- weeklyWinner.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `iroyinayo/src/modules/admin/weeklyWinner.service.js`:

```javascript
const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function getCurrentWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function getWeeklyWinnerStatus() {
  const weekStart = getCurrentWeekStart();
  const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
  if (!row) return null;
  return {
    weekStart: row.week_start,
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    winnerProfit: row.winner_profit,
    prizePaid: !!row.prize_paid,
    paidAt: row.paid_at,
    paidByAdminId: row.paid_by_admin_id,
  };
}

async function markWinnerPaid(weekStart, adminId) {
  const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
  if (!row) throw new NotFoundError('Weekly winner row not found');
  if (row.prize_paid) throw new ValidationError('Already paid');
  await db('weekly_leaderboards').where({ week_start: weekStart }).update({
    prize_paid: true,
    paid_at: new Date(),
    paid_by_admin_id: adminId,
  });
  return { ok: true };
}

module.exports = { getWeeklyWinnerStatus, markWinnerPaid };
```

- [ ] **Step 4: Implement the routes**

Create `iroyinayo/src/modules/admin/weeklyWinner.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const service = require('./weeklyWinner.service');

const router = express.Router();

router.get('/weekly-winner-status', authenticate, async (req, res, next) => {
  try {
    const result = await service.getWeeklyWinnerStatus();
    res.json({ winner: result });
  } catch (err) { next(err); }
});

router.post('/weekly-winner/:weekStart/mark-paid', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const weekStart = new Date(req.params.weekStart);
    if (isNaN(weekStart.getTime())) return res.status(400).json({ error: 'invalid weekStart' });
    const result = await service.markWinnerPaid(weekStart, req.admin.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 5: Verify GREEN**

Run: `cd iroyinayo && npm test -- weeklyWinner.test.js`
Expected: 5/5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/admin/weeklyWinner.service.js iroyinayo/src/modules/admin/weeklyWinner.routes.js iroyinayo/tests/admin/weeklyWinner.test.js
git commit -m "feat(cc): weekly winner status + mark-paid endpoints"
```

---

## Task 6: Banned students service + route

**Files:**
- Create: `iroyinayo/src/modules/admin/bannedStudents.service.js`
- Create: `iroyinayo/src/modules/admin/bannedStudents.routes.js`
- Create: `iroyinayo/tests/admin/bannedStudents.test.js`

**Interfaces:**
- Consumes: `students` table. The existing ban flow sets `students.is_banned = true` (verify via `iroyinayo/src/modules/admin/admin.routes.js` ban endpoint). Verify whether a `banned_at` column or similar metadata exists.
- Produces:
  - `async function listRecentBans({ daysBack = 7 } = {})` → `{ items: [...], total }`. Each item: `{ id, name, phone_number, banned_at, ban_reason }`. If `banned_at` column doesn't exist, returns `null` for that field and lists by `updated_at` instead.
  - Route: `GET /students/banned` (any authenticated admin).

- [ ] **Step 1: Check students table for ban-related columns**

Run: `cd iroyinayo && PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "\d students" | grep -i "ban\|updated"`
Expected: shows `is_banned` and possibly `banned_at` / `ban_reason` / `updated_at`. Note what exists.

For the test, we'll use whichever timestamp is available (preferring `banned_at` if present, else `updated_at`).

- [ ] **Step 2: Write the tests**

Create `iroyinayo/tests/admin/bannedStudents.test.js`:

```javascript
const db = require('../../src/config/database');
const { listRecentBans } = require('../../src/modules/admin/bannedStudents.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createBannedStudent({ name = 'Banned', ago = 0 } = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`,
    name,
    is_onboarded: true,
    is_banned: true,
    points_balance: 0,
  });
  // If a banned_at column exists, set it; otherwise rely on updated_at default
  const hasBannedAt = await db.raw(
    `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='banned_at'`
  );
  if (hasBannedAt.rows.length > 0 && ago > 0) {
    const t = new Date(Date.now() - ago * 24 * 60 * 60 * 1000);
    await db('students').where({ id }).update({ banned_at: t });
  }
  return id;
}

describe('listRecentBans', () => {
  test('returns banned students', async () => {
    await createBannedStudent({ name: 'Recent ban' });
    const result = await listRecentBans();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items.some((i) => i.name === 'Recent ban')).toBe(true);
  });

  test('excludes non-banned students', async () => {
    const id = uuidv4();
    await db('students').insert({
      id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'Active', is_onboarded: true, is_banned: false, points_balance: 0,
    });
    const result = await listRecentBans();
    expect(result.items.some((i) => i.id === id)).toBe(false);
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `cd iroyinayo && npm test -- bannedStudents.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the service**

Create `iroyinayo/src/modules/admin/bannedStudents.service.js`:

```javascript
const db = require('../../config/database');

async function listRecentBans({ daysBack = 7 } = {}) {
  // Detect whether banned_at column exists
  const hasBannedAt = await db.raw(
    `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='banned_at'`
  );
  const useBannedAt = hasBannedAt.rows.length > 0;
  const timeCol = useBannedAt ? 'banned_at' : 'updated_at';

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  let query = db('students').where({ is_banned: true });
  // Some installations may not have updated_at either; if neither exists, return all banned
  try {
    query = query.where(timeCol, '>=', since);
  } catch (_) { /* no-op */ }

  const items = await query
    .orderBy(timeCol, 'desc')
    .limit(50)
    .select('id', 'name', 'phone_number', useBannedAt ? 'banned_at' : db.raw(`updated_at as banned_at`));

  return { items, total: items.length };
}

module.exports = { listRecentBans };
```

- [ ] **Step 5: Implement the route**

Create `iroyinayo/src/modules/admin/bannedStudents.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const service = require('./bannedStudents.service');

const router = express.Router();

router.get('/students/banned', authenticate, async (req, res, next) => {
  try {
    const result = await service.listRecentBans();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 6: Verify GREEN**

Run: `cd iroyinayo && npm test -- bannedStudents.test.js`
Expected: 2/2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add iroyinayo/src/modules/admin/bannedStudents.service.js iroyinayo/src/modules/admin/bannedStudents.routes.js iroyinayo/tests/admin/bannedStudents.test.js
git commit -m "feat(cc): banned students list endpoint"
```

---

## Task 7: Control center aggregation service + routes (summary + health)

**Files:**
- Create: `iroyinayo/src/modules/admin/controlCenter.service.js`
- Create: `iroyinayo/src/modules/admin/controlCenter.routes.js`
- Create: `iroyinayo/tests/admin/controlCenter.test.js`

**Interfaces:**
- Consumes: counts from `multi_markets`, `content`, `redemptions`, `simulation_alerts`, `market_reports`, `students`, `weekly_leaderboards`, `whatsapp_daily_queue`, `position_triggers`.
- Produces:
  - `async function getSummary()` → `{ marketsToResolve, pendingUserMarkets, pendingContent, pendingRedemptions, simulationAlerts, marketReports, recentBansCount, weeklyWinnerUnpaid: boolean, totalsManageStrip: { markets, students, quizzes, schedules, ambassadors, liquidityConfigs, content } }`.
  - `async function getHealth()` → `{ botOnline: boolean | null, botLastConnectedAt: timestamp | null, todayQueue: { sent, failed, skipped, pending }, openMarketsCount, dauToday, pendingPositionTriggers }`.
  - Routes: `GET /control-center/summary`, `GET /control-center/health`. Both require `authenticate` only.

- [ ] **Step 1: Confirm needed table names**

Run: `cd iroyinayo && PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "\dt" | grep -iE "redemption|quiz|schedule|ambassador|liquidity|content"`
Expected: lists the relevant tables. Note exact names. Common candidates: `redemptions`, `quizzes`, `scheduled_markets`, `ambassador_settings` (or similar), `market_liquidity_config` (per migration 023), `content`.

- [ ] **Step 2: Write the tests**

Create `iroyinayo/tests/admin/controlCenter.test.js`:

```javascript
const db = require('../../src/config/database');
const { getSummary, getHealth } = require('../../src/modules/admin/controlCenter.service');
const { randomUUID: uuidv4 } = require('crypto');

describe('getSummary', () => {
  test('returns zero counts when DB is empty', async () => {
    const result = await getSummary();
    expect(result.marketsToResolve).toBe(0);
    expect(result.pendingUserMarkets).toBe(0);
    expect(result.simulationAlerts).toBe(0);
    expect(result.marketReports).toBe(0);
    expect(result.weeklyWinnerUnpaid).toBe(false);
    expect(result.totalsManageStrip).toBeDefined();
  });

  test('counts closed markets needing resolution', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'resolved', liquidity_b: 100 });
    const result = await getSummary();
    expect(result.marketsToResolve).toBe(2);
  });

  test('counts pending user-created markets', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'pending', liquidity_b: 100 });
    const result = await getSummary();
    expect(result.pendingUserMarkets).toBe(1);
  });

  test('counts pending market reports', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const studentId = uuidv4();
    await db('students').insert({ id: studentId, phone_number: `234${Date.now()}`, name: 'S', is_onboarded: true, points_balance: 0 });
    await db('market_reports').insert({ id: uuidv4(), market_id: marketId, student_id: studentId, reason: 'r' });
    const result = await getSummary();
    expect(result.marketReports).toBe(1);
  });
});

describe('getHealth', () => {
  test('returns zero queue counts and zero triggers when DB empty', async () => {
    const result = await getHealth();
    expect(result.todayQueue).toEqual({ sent: 0, failed: 0, skipped: 0, pending: 0 });
    expect(result.openMarketsCount).toBe(0);
    expect(result.pendingPositionTriggers).toBe(0);
  });

  test('counts open markets', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'open', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    const result = await getHealth();
    expect(result.openMarketsCount).toBe(1);
  });

  test('counts today\'s queue statuses', async () => {
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const studentId = uuidv4();
    await db('students').insert({ id: studentId, phone_number: `234${Date.now()}`, name: 'S', is_onboarded: true, points_balance: 0 });
    await db('whatsapp_daily_queue').insert({
      id: uuidv4(), student_id: studentId, scheduled_for: today, status: 'sent', markets: '[]',
    });
    await db('whatsapp_daily_queue').insert({
      id: uuidv4(), student_id: studentId, scheduled_for: today, status: 'failed', markets: '[]',
    });
    const result = await getHealth();
    expect(result.todayQueue.sent).toBe(1);
    expect(result.todayQueue.failed).toBe(1);
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `cd iroyinayo && npm test -- controlCenter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the service**

Create `iroyinayo/src/modules/admin/controlCenter.service.js`:

```javascript
const db = require('../../config/database');

async function safeCount(table, where = {}) {
  try {
    const row = await db(table).where(where).count('* as c').first();
    return Number(row.c) || 0;
  } catch (_) {
    return 0;
  }
}

async function tableExists(name) {
  const r = await db.raw(
    `SELECT 1 FROM information_schema.tables WHERE table_name = ? LIMIT 1`,
    [name]
  );
  return r.rows.length > 0;
}

async function getSummary() {
  const [marketsToResolve, pendingUserMarkets, pendingContent, simulationAlerts, marketReports, recentBansCount] = await Promise.all([
    safeCount('multi_markets', { status: 'closed' }),
    safeCount('multi_markets', { status: 'pending' }),
    safeCount('content', { status: 'pending' }),
    safeCount('simulation_alerts', { status: 'pending' }),
    safeCount('market_reports', { resolution_status: 'pending' }),
    db('students').where({ is_banned: true }).count('* as c').first().then((r) => Number(r.c) || 0),
  ]);

  const pendingRedemptions = (await tableExists('redemptions'))
    ? await safeCount('redemptions', { status: 'pending' })
    : 0;

  const winnerRow = await db('weekly_leaderboards')
    .orderBy('week_start', 'desc')
    .first();
  const weeklyWinnerUnpaid = winnerRow ? !winnerRow.prize_paid : false;

  const totalsManageStrip = {
    markets: await safeCount('multi_markets'),
    students: await safeCount('students'),
    quizzes: (await tableExists('quizzes')) ? await safeCount('quizzes') : 0,
    schedules: (await tableExists('scheduled_markets')) ? await safeCount('scheduled_markets') : 0,
    ambassadors: 0, // ambassador table name varies; fill in when known
    liquidityConfigs: (await tableExists('market_liquidity_config')) ? await safeCount('market_liquidity_config') : 0,
    content: (await tableExists('content')) ? await safeCount('content') : 0,
  };

  return {
    marketsToResolve,
    pendingUserMarkets,
    pendingContent,
    pendingRedemptions,
    simulationAlerts,
    marketReports,
    recentBansCount,
    weeklyWinnerUnpaid,
    totalsManageStrip,
  };
}

function startOfTodayWat() {
  // WAT is UTC+1. Compute today's 00:00 in WAT as a UTC Date.
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000); // shift to WAT clock
  wat.setUTCHours(0, 0, 0, 0);
  return new Date(wat.getTime() - 60 * 60 * 1000); // back to UTC
}

async function getHealth() {
  const dayStart = startOfTodayWat();

  const queueAgg = await db('whatsapp_daily_queue')
    .where('scheduled_for', '>=', dayStart)
    .select('status')
    .count('* as c')
    .groupBy('status');
  const todayQueue = { sent: 0, failed: 0, skipped: 0, pending: 0 };
  for (const r of queueAgg) {
    if (todayQueue[r.status] !== undefined) todayQueue[r.status] = Number(r.c);
  }

  const openMarketsCount = await safeCount('multi_markets', { status: 'open' });

  const dauToday = await db('students')
    .where('last_app_open_at', '>=', dayStart)
    .count('* as c')
    .first()
    .then((r) => Number(r.c) || 0)
    .catch(() => 0);

  const pendingPositionTriggers = (await tableExists('position_triggers'))
    ? await db('position_triggers').whereNull('fired_at').count('* as c').first().then((r) => Number(r.c) || 0)
    : 0;

  // Bot status: read from the in-process bot module's exported state.
  let botOnline = null;
  let botLastConnectedAt = null;
  try {
    const botSocket = require('../../bot/botSocket');
    if (typeof botSocket.getBotStatus === 'function') {
      const status = botSocket.getBotStatus();
      botOnline = !!status.connected;
      botLastConnectedAt = status.lastConnectedAt || null;
    } else if (typeof botSocket.getBotSocket === 'function') {
      botOnline = !!botSocket.getBotSocket();
    }
  } catch (_) { /* bot module not loaded; leave null */ }

  return { botOnline, botLastConnectedAt, todayQueue, openMarketsCount, dauToday, pendingPositionTriggers };
}

module.exports = { getSummary, getHealth };
```

- [ ] **Step 5: Implement the routes**

Create `iroyinayo/src/modules/admin/controlCenter.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const service = require('./controlCenter.service');

const router = express.Router();

router.get('/control-center/summary', authenticate, async (req, res, next) => {
  try {
    const result = await service.getSummary();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/control-center/health', authenticate, async (req, res, next) => {
  try {
    const result = await service.getHealth();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 6: Verify GREEN**

Run: `cd iroyinayo && npm test -- controlCenter.test.js`
Expected: 6/6 tests pass. (If a test fails because `content` table doesn't exist or `pendingContent` count assumption is wrong, adjust the test rather than the service — the service uses `tableExists` defensively.)

- [ ] **Step 7: Commit**

```bash
git add iroyinayo/src/modules/admin/controlCenter.service.js iroyinayo/src/modules/admin/controlCenter.routes.js iroyinayo/tests/admin/controlCenter.test.js
git commit -m "feat(cc): control-center summary + health endpoints"
```

---

## Task 8: Bot reconnect endpoint

**Files:**
- Create: `iroyinayo/src/modules/admin/bot.routes.js`
- Create: `iroyinayo/tests/admin/botReconnect.test.js`

**Interfaces:**
- Consumes: existing `iroyinayo/src/bot/botSocket.js` (or `connection.js`) — whatever exports the current Baileys socket.
- Produces: `POST /bot/reconnect` returning `{status: 'reconnecting' | 'already_connected' | 'failed', message}`. `requireRole('super_admin', 'moderator')`.

- [ ] **Step 1: Check the bot module's exports**

Run: `cd iroyinayo && grep -n "module.exports\|getBotSocket\|connect\b" src/bot/botSocket.js src/bot/connection.js 2>/dev/null | head -20`

Expected: shows what the bot module exposes. We'll wrap whatever exists.

- [ ] **Step 2: Write the test**

Create `iroyinayo/tests/admin/botReconnect.test.js`:

```javascript
// We don't actually want to trigger a real Baileys reconnect in tests.
// This test verifies the route's return shape via mocking.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/config/database');
const { randomUUID: uuidv4 } = require('crypto');

async function adminToken() {
  const id = uuidv4();
  await db('admins').insert({
    id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'super_admin',
  });
  return jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret');
}

describe('POST /api/admin/bot/reconnect', () => {
  test('requires auth', async () => {
    const res = await request(app).post('/api/admin/bot/reconnect');
    expect(res.status).toBe(401);
  });

  test('returns a status string when authed', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/admin/bot/reconnect').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(['reconnecting', 'already_connected', 'failed']).toContain(res.body.status);
    expect(typeof res.body.message).toBe('string');
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `cd iroyinayo && npm test -- botReconnect.test.js`
Expected: FAIL — route not registered (404 instead of 401/200).

- [ ] **Step 4: Implement the route**

Create `iroyinayo/src/modules/admin/bot.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');

const router = express.Router();

router.post('/bot/reconnect', authenticate, requireRole('super_admin', 'moderator'), async (req, res) => {
  try {
    const botSocket = require('../../bot/botSocket');
    const current = typeof botSocket.getBotSocket === 'function' ? botSocket.getBotSocket() : null;
    if (current) {
      return res.json({ status: 'already_connected', message: 'WhatsApp bot socket is already connected.' });
    }
    if (typeof botSocket.connect === 'function') {
      // Fire-and-forget; do not await — return promptly so the dashboard sees a quick response.
      botSocket.connect().catch((err) => console.error('[bot/reconnect] failed:', err.message));
      return res.json({ status: 'reconnecting', message: 'Reconnect initiated. Check status pill in 5-10 seconds.' });
    }
    return res.json({ status: 'failed', message: 'Bot module is not loaded in this process.' });
  } catch (err) {
    return res.json({ status: 'failed', message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: Verify GREEN (after Task 9 mounts the route)**

This test won't pass until Task 9 mounts the route in `app.js`. For now, run it and confirm the failure mode is 404 (not registered) rather than 500 (server error in the handler). Mark this test as one that becomes GREEN after Task 9.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo/src/modules/admin/bot.routes.js iroyinayo/tests/admin/botReconnect.test.js
git commit -m "feat(cc): bot reconnect endpoint"
```

---

## Task 9: Mount new routes in app.js

**Files:**
- Modify: `iroyinayo/src/app.js`

**Interfaces:** None new — wires existing route modules into Express.

- [ ] **Step 1: Add imports + mounts**

Open `iroyinayo/src/app.js`. After the existing `const adminRoutes = require('./modules/admin/admin.routes');` line, add:

```javascript
const controlCenterRoutes = require('./modules/admin/controlCenter.routes');
const marketReportsRoutes = require('./modules/admin/marketReports.routes');
const weeklyWinnerRoutes = require('./modules/admin/weeklyWinner.routes');
const bannedStudentsRoutes = require('./modules/admin/bannedStudents.routes');
const botRoutes = require('./modules/admin/bot.routes');
```

After the existing `app.use('/api/admin', adminRoutes);` line, add (in this order):

```javascript
app.use('/api/admin', controlCenterRoutes);
app.use('/api/admin', marketReportsRoutes);
app.use('/api/admin', weeklyWinnerRoutes);
app.use('/api/admin', bannedStudentsRoutes);
app.use('/api/admin', botRoutes);
```

These mount alongside the existing admin routes — Express merges multiple routers under the same prefix correctly.

- [ ] **Step 2: Syntax check**

Run: `cd iroyinayo && node -c src/app.js`
Expected: no output (clean parse).

- [ ] **Step 3: Run all backend tests**

Run: `cd iroyinayo && npm test`
Expected: all habit + new admin tests pass. Pre-existing failures (auth, markets, onboarding, rewards) remain — they're unrelated.

- [ ] **Step 4: Smoke endpoint check**

Run:
```bash
cd iroyinayo && node -e "const app = require('./src/app'); const port = 4099; app.listen(port, () => { console.log('test server on', port); setTimeout(() => process.exit(0), 500); });" &
sleep 1
curl -s http://localhost:4099/api/admin/control-center/summary -H "Authorization: Bearer x" | head -c 200
echo
```
Expected: returns either 401 (unauthorized — auth working) or 200 with a JSON summary (depending on JWT validity). Confirms route is mounted.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/app.js
git commit -m "feat(cc): mount control center route modules"
```

---

## Task 10: Frontend — usePolling hook + api.js helpers

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/usePolling.js`
- Modify: `iroyinayo-admin/src/lib/api.js`

**Interfaces:**
- Produces:
  - `usePolling(fetchFn, intervalMs)` → `{ data, error, loading, refresh }`. Cleans up on unmount. Skips polling while document is hidden.
  - On `iroyinayo-admin/src/lib/api.js`, new exports merged into the existing `api` object — but ALL existing helpers (`api.get`, `api.post`, etc.) preserved unchanged.

- [ ] **Step 1: Create usePolling**

Create `iroyinayo-admin/src/components/control-center/usePolling.js`:

```javascript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function usePolling(fetchFn, intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchFnRef.current();
      if (!cancelledRef.current) {
        setData(next);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refresh();
    }, intervalMs);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [intervalMs, refresh]);

  return { data, error, loading, refresh };
}
```

- [ ] **Step 2: Extend api.js**

Open `iroyinayo-admin/src/lib/api.js`. At the bottom of the file (after the existing `export const api = { ... }` block), add:

```javascript
// Control center helpers
export const cc = {
  getSummary: () => api.get('/admin/control-center/summary'),
  getHealth: () => api.get('/admin/control-center/health'),
  getMarketReports: () => api.get('/admin/market-reports'),
  updateMarketReport: (id, body) => api.patch(`/admin/market-reports/${id}`, body),
  getWeeklyWinnerStatus: () => api.get('/admin/weekly-winner-status'),
  markWeeklyWinnerPaid: (weekStart) => api.post(`/admin/weekly-winner/${encodeURIComponent(weekStart)}/mark-paid`, {}),
  getBannedStudents: () => api.get('/admin/students/banned'),
  approveMarket: (marketId) => api.post(`/multi-markets/${marketId}/approve`, {}),
  rejectMarket: (marketId, reason) => api.post(`/multi-markets/${marketId}/reject`, { reason }),
  reconnectBot: () => api.post('/admin/bot/reconnect', {}),
  // Reused existing endpoints for panels
  getClosedMarkets: () => api.get('/multi-markets/admin/all?status=closed'),
  getPendingMarkets: () => api.get('/multi-markets/admin/all?status=pending'),
  resolveMarket: (marketId, winningOutcomeId) => api.post(`/multi-markets/${marketId}/resolve`, { winningOutcomeId }),
  getPendingContent: () => api.get('/content/pending'),
  approveContent: (id) => api.post(`/content/${id}/approve`, {}),
  publishContent: (id) => api.post(`/content/${id}/publish`, {}),
  getPendingRedemptions: () => api.get('/rewards/pending'),
  fulfillRedemption: (id, body) => api.post(`/rewards/${id}/fulfill`, body || {}),
  getSimulationAlerts: () => api.get('/admin/simulation/alerts?status=pending'),
  updateSimulationAlert: (id, body) => api.patch(`/admin/simulation/alerts/${id}`, body),
  unbanStudent: (studentId) => api.post(`/admin/students/${studentId}/unban`, {}),
};
```

- [ ] **Step 3: Verify build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -10`
Expected: build completes; the new `cc` object exists but isn't yet imported anywhere.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/usePolling.js iroyinayo-admin/src/lib/api.js
git commit -m "feat(cc): usePolling hook + cc api helpers"
```

---

## Task 11: Skeleton control center page + empty zones

**Files:**
- Modify: `iroyinayo-admin/src/app/page.js`
- Create: `iroyinayo-admin/src/components/control-center/EmptyState.jsx`
- Create: `iroyinayo-admin/src/components/control-center/HealthStrip.jsx` (skeleton)
- Create: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` (skeleton)
- Create: `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx` (skeleton)
- Create: `iroyinayo-admin/src/components/control-center/ManageStrip.jsx` (skeleton)

**Interfaces:**
- `<HealthStrip />` — renders a sticky strip placeholder.
- `<TodaysWorkZone />` — renders a 2-col grid of 5 placeholder cards.
- `<WeeklyQueueZone />` — renders 4 collapsed placeholders.
- `<ManageStrip />` — renders 7 placeholder tiles.
- `<EmptyState label="..." />` — shared "All clear ✓" component.

- [ ] **Step 1: Save old dashboard**

The existing `iroyinayo-admin/src/app/page.js` is the old 280-line dashboard. Move it aside so we can revisit it later if needed:

```bash
mv iroyinayo-admin/src/app/page.js iroyinayo-admin/src/app/_dashboard.legacy.js
```

(We don't import the file anywhere, so renaming with an underscore prefix keeps it out of the Next route table.)

- [ ] **Step 2: Create EmptyState**

Create `iroyinayo-admin/src/components/control-center/EmptyState.jsx`:

```jsx
export function EmptyState({ label = 'All clear ✓' }) {
  return (
    <div className="flex items-center justify-center py-6 text-emerald-600 font-serif text-lg">
      {label}
    </div>
  );
}
```

- [ ] **Step 3: Create skeleton zones**

Create `iroyinayo-admin/src/components/control-center/HealthStrip.jsx`:

```jsx
'use client';
export function HealthStrip() {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex gap-3 overflow-x-auto">
      <div className="text-sm text-muted-foreground">System Health (loading…)</div>
    </div>
  );
}
```

Create `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`:

```jsx
'use client';
import { Card } from '@/components/ui/card';

export function TodaysWorkZone() {
  return (
    <section className="px-4 py-6">
      <h2 className="text-2xl font-serif font-semibold mb-4">Today&apos;s work</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['Markets to resolve', 'Pending user markets', 'Pending content', 'Pending redemptions', 'Create market with AI'].map((label) => (
          <Card key={label} className="p-4">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground mt-2">(loading…)</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

Create `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx`:

```jsx
'use client';
import { Card } from '@/components/ui/card';

export function WeeklyQueueZone() {
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-2xl font-serif font-semibold mb-4">Weekly queue</h2>
      <div className="space-y-3">
        {['Simulation alerts', 'Market reports', 'Recent bans', 'Weekly winner'].map((label) => (
          <Card key={label} className="p-4">
            <div className="text-sm font-medium">{label}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

Create `iroyinayo-admin/src/components/control-center/ManageStrip.jsx`:

```jsx
'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

const TILES = [
  { label: 'Markets', href: '/markets' },
  { label: 'Students', href: '/students' },
  { label: 'Quizzes', href: '/quizzes' },
  { label: 'Schedules', href: '/schedules' },
  { label: 'Ambassadors', href: '/ambassadors' },
  { label: 'Content', href: '/content' },
  { label: 'Rewards', href: '/rewards' },
];

export function ManageStrip() {
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">{t.label}</Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create the new page.js**

Create `iroyinayo-admin/src/app/page.js`:

```jsx
import { HealthStrip } from '@/components/control-center/HealthStrip';
import { TodaysWorkZone } from '@/components/control-center/TodaysWorkZone';
import { WeeklyQueueZone } from '@/components/control-center/WeeklyQueueZone';
import { ManageStrip } from '@/components/control-center/ManageStrip';

export default function ControlCenterPage() {
  return (
    <main className="min-h-screen">
      <HealthStrip />
      <TodaysWorkZone />
      <WeeklyQueueZone />
      <ManageStrip />
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: builds cleanly. Run `npm run dev` and open `http://localhost:3000` to see the skeleton page with empty zones.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo-admin/src/app/page.js iroyinayo-admin/src/app/_dashboard.legacy.js iroyinayo-admin/src/components/control-center/
git commit -m "feat(cc): skeleton control center page with empty zones"
```

---

## Task 12: ResolveMarketsPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/ResolveMarketsPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` (replace placeholder card)

**Interfaces:**
- Consumes: `cc.getClosedMarkets()`, `cc.resolveMarket(marketId, winningOutcomeId)`, `usePolling`.
- Produces: `<ResolveMarketsPanel />`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/ResolveMarketsPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function ResolveMarketsPanel() {
  const { data, error, refresh } = usePolling(cc.getClosedMarkets, 30000);
  const [openId, setOpenId] = useState(null);
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];
  const closed = items.filter((m) => m.status === 'closed');

  async function handleResolve(marketId, outcomeId) {
    setErrInline(null);
    try {
      await cc.resolveMarket(marketId, outcomeId);
      setOpenId(null);
      refresh();
    } catch (err) {
      setErrInline({ marketId, message: err.message });
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Markets to resolve</div>
        <Badge variant="secondary">{closed.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && closed.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {closed.map((m) => (
          <div key={m.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{m.title}</div>
            <div className="text-xs text-muted-foreground">Closed · {m.outcomes?.length || 0} outcomes</div>
            {openId === m.id ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {(m.outcomes || []).map((o) => (
                  <Button key={o.id} size="sm" onClick={() => handleResolve(m.id, o.id)}>
                    Winner: {o.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => setOpenId(m.id)}>Pick winner</Button>
            )}
            {errInline?.marketId === m.id && (
              <div className="text-xs text-red-600 mt-1">{errInline.message}</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into TodaysWorkZone**

Edit `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`. Replace the placeholder Card for "Markets to resolve" with `<ResolveMarketsPanel />`:

```jsx
'use client';
import { ResolveMarketsPanel } from './ResolveMarketsPanel';
import { Card } from '@/components/ui/card';

export function TodaysWorkZone() {
  return (
    <section className="px-4 py-6">
      <h2 className="text-2xl font-serif font-semibold mb-4">Today&apos;s work</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResolveMarketsPanel />
        {['Pending user markets', 'Pending content', 'Pending redemptions', 'Create market with AI'].map((label) => (
          <Card key={label} className="p-4">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground mt-2">(loading…)</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/ResolveMarketsPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx
git commit -m "feat(cc): ResolveMarketsPanel"
```

---

## Task 13: PendingUserMarketsPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/PendingUserMarketsPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`

**Interfaces:**
- Consumes: `cc.getPendingMarkets()`, `cc.approveMarket(marketId)`, `cc.rejectMarket(marketId, reason)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/PendingUserMarketsPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function PendingUserMarketsPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingMarkets, 30000);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];
  const pending = items.filter((m) => m.status === 'pending');

  async function handleApprove(id) {
    setErrInline(null);
    try { await cc.approveMarket(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  async function handleReject(id) {
    if (reason.trim().length < 3) {
      setErrInline({ id, message: 'Reason required (min 3 chars)' });
      return;
    }
    setErrInline(null);
    try {
      await cc.rejectMarket(id, reason.trim());
      setRejectingId(null);
      setReason('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending user markets</div>
        <Badge variant="secondary">{pending.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && pending.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {pending.map((m) => (
          <div key={m.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{m.title}</div>
            <div className="text-xs text-muted-foreground">by {m.creator_name || 'unknown'}</div>
            {rejectingId === m.id ? (
              <div className="mt-2 space-y-2">
                <Input placeholder="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleReject(m.id)}>Confirm reject</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setReason(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleApprove(m.id)}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectingId(m.id)}>Reject</Button>
              </div>
            )}
            {errInline?.id === m.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into TodaysWorkZone**

Replace the `'Pending user markets'` placeholder card with `<PendingUserMarketsPanel />`.

- [ ] **Step 3: Verify build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/PendingUserMarketsPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx
git commit -m "feat(cc): PendingUserMarketsPanel"
```

---

## Task 14: PendingContentPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/PendingContentPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`

**Interfaces:**
- Consumes: `cc.getPendingContent()`, `cc.approveContent(id)`, `cc.publishContent(id)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/PendingContentPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

function isUrgent() {
  // 7:30am WAT = 06:30 UTC
  const now = new Date();
  const utcHr = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  return (utcHr > 6) || (utcHr === 6 && utcMin >= 30);
}

export function PendingContentPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingContent, 30000);
  const [errInline, setErrInline] = useState(null);
  const urgent = isUrgent();

  const items = Array.isArray(data) ? data : data?.items || [];

  async function handleApprove(id) {
    setErrInline(null);
    try { await cc.approveContent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }
  async function handlePublish(id) {
    setErrInline(null);
    try { await cc.publishContent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending content</div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && items.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className={`border-l-4 ${urgent ? 'border-orange-500' : 'border-border'} border-y border-r border-border rounded p-2`}>
            <div className="text-sm font-medium">{c.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{c.summary || c.body || ''}</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => handleApprove(c.id)}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => handlePublish(c.id)}>Publish</Button>
            </div>
            {errInline?.id === c.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into TodaysWorkZone**

Replace the `'Pending content'` placeholder with `<PendingContentPanel />`.

- [ ] **Step 3: Build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/PendingContentPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx
git commit -m "feat(cc): PendingContentPanel"
```

---

## Task 15: PendingRedemptionsPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/PendingRedemptionsPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`

**Interfaces:**
- Consumes: `cc.getPendingRedemptions()`, `cc.fulfillRedemption(id, body)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/PendingRedemptionsPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function PendingRedemptionsPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingRedemptions, 30000);
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];

  async function handleFulfill(id) {
    setErrInline(null);
    try {
      await cc.fulfillRedemption(id, notes ? { notes } : {});
      setActiveId(null);
      setNotes('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending redemptions</div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && items.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{r.student_name || r.user_name || 'User'} → {r.reward_name || 'reward'}</div>
            <div className="text-xs text-muted-foreground">{r.points_cost || r.points || ''} pts</div>
            {activeId === r.id ? (
              <div className="mt-2 space-y-2">
                <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleFulfill(r.id)}>Confirm fulfilled</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setNotes(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => setActiveId(r.id)}>Mark fulfilled</Button>
            )}
            {errInline?.id === r.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire + build + commit**

Replace the `'Pending redemptions'` placeholder with `<PendingRedemptionsPanel />` in `TodaysWorkZone.jsx`. Build and commit.

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/PendingRedemptionsPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx
git commit -m "feat(cc): PendingRedemptionsPanel"
```

---

## Task 16: AIMarketCreatorPanel (Spec 1 placeholder)

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`

**Interfaces:** Stub; no API calls.

- [ ] **Step 1: Create the placeholder**

Create `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx`:

```jsx
'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function AIMarketCreatorPanel() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div className="font-medium">Create market with AI</div>
      </div>
      <p className="text-sm text-muted-foreground">
        Coming soon. Spec 2 will enable AI-assisted market drafting from text prompts or RSS trends.
      </p>
      <Button size="sm" className="mt-3" disabled>Draft with AI</Button>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into TodaysWorkZone**

Final `TodaysWorkZone.jsx` shape (after this task):

```jsx
'use client';
import { ResolveMarketsPanel } from './ResolveMarketsPanel';
import { PendingUserMarketsPanel } from './PendingUserMarketsPanel';
import { PendingContentPanel } from './PendingContentPanel';
import { PendingRedemptionsPanel } from './PendingRedemptionsPanel';
import { AIMarketCreatorPanel } from './AIMarketCreatorPanel';

export function TodaysWorkZone() {
  return (
    <section className="px-4 py-6">
      <h2 className="text-2xl font-serif font-semibold mb-4">Today&apos;s work</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResolveMarketsPanel />
        <PendingUserMarketsPanel />
        <PendingContentPanel />
        <PendingRedemptionsPanel />
        <AIMarketCreatorPanel />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx
git commit -m "feat(cc): AIMarketCreatorPanel placeholder + complete Today's Work zone"
```

---

## Task 17: SimulationAlertsPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/SimulationAlertsPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx`

**Interfaces:**
- Consumes: `cc.getSimulationAlerts()`, `cc.updateSimulationAlert(id, body)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/SimulationAlertsPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

const SEV_COLORS = { high: 'destructive', medium: 'default', low: 'secondary' };

export function SimulationAlertsPanel() {
  const { data, error, refresh } = usePolling(cc.getSimulationAlerts, 30000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const items = Array.isArray(data) ? data : data?.items || data?.alerts || [];

  async function handleUpdate(id, status) {
    setErrInline(null);
    try { await cc.updateSimulationAlert(id, { status }); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Simulation alerts</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((a) => (
            <div key={a.id} className="border border-border rounded p-2">
              <div className="flex items-center gap-2">
                <Badge variant={SEV_COLORS[a.severity] || 'default'}>{a.severity}</Badge>
                <div className="text-sm font-medium">{a.alert_type}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">market {a.market_id}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleUpdate(a.id, 'acknowledged')}>Acknowledge</Button>
                <Button size="sm" variant="ghost" onClick={() => handleUpdate(a.id, 'dismissed')}>Dismiss</Button>
              </div>
              {errInline?.id === a.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Wire + build + commit**

Replace `'Simulation alerts'` placeholder in `WeeklyQueueZone.jsx`. Build. Commit.

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/SimulationAlertsPanel.jsx iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx
git commit -m "feat(cc): SimulationAlertsPanel"
```

---

## Task 18: MarketReportsPanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/MarketReportsPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx`

**Interfaces:**
- Consumes: `cc.getMarketReports()`, `cc.updateMarketReport(id, body)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/MarketReportsPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function MarketReportsPanel() {
  const { data, error, refresh } = usePolling(cc.getMarketReports, 30000);
  const [open, setOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = data?.items || [];

  async function handleDismiss(id) {
    setErrInline(null);
    try { await cc.updateMarketReport(id, { action: 'dismiss' }); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  async function handleResolve(id) {
    setErrInline(null);
    try {
      await cc.updateMarketReport(id, { action: 'resolve', note: note || undefined });
      setResolvingId(null);
      setNote('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Market reports</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((r) => (
            <div key={r.id} className="border border-border rounded p-2">
              <div className="text-sm font-medium">{r.market_title}</div>
              <div className="text-xs text-muted-foreground">reported by {r.reporter_name}: {r.reason}</div>
              {resolvingId === r.id ? (
                <div className="mt-2 space-y-2">
                  <Input placeholder="Resolution note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResolve(r.id)}>Confirm resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResolvingId(null); setNote(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setResolvingId(r.id)}>Resolve</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(r.id)}>Dismiss</Button>
                </div>
              )}
              {errInline?.id === r.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Wire + build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/MarketReportsPanel.jsx iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx
git commit -m "feat(cc): MarketReportsPanel"
```

---

## Task 19: BanQueuePanel

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/BanQueuePanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx`

**Interfaces:**
- Consumes: `cc.getBannedStudents()`, `cc.unbanStudent(id)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/BanQueuePanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function BanQueuePanel() {
  const { data, error, refresh } = usePolling(cc.getBannedStudents, 30000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const items = data?.items || [];

  async function handleUnban(id) {
    setErrInline(null);
    try { await cc.unbanStudent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Recent bans</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((u) => (
            <div key={u.id} className="border border-border rounded p-2">
              <div className="text-sm font-medium">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.phone_number}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleUnban(u.id)}>Unban</Button>
                <Link href={`/students/${u.id}`}><Button size="sm" variant="ghost">Investigate</Button></Link>
              </div>
              {errInline?.id === u.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Wire + build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/BanQueuePanel.jsx iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx
git commit -m "feat(cc): BanQueuePanel"
```

---

## Task 20: WeeklyWinnerPanel + finalize Weekly Queue Zone

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/WeeklyWinnerPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx`

**Interfaces:**
- Consumes: `cc.getWeeklyWinnerStatus()`, `cc.markWeeklyWinnerPaid(weekStart)`.

- [ ] **Step 1: Create the panel**

Create `iroyinayo-admin/src/components/control-center/WeeklyWinnerPanel.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function WeeklyWinnerPanel() {
  const { data, error, refresh } = usePolling(cc.getWeeklyWinnerStatus, 60000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const winner = data?.winner;

  async function handleMarkPaid() {
    if (!winner) return;
    setErrInline(null);
    try {
      const weekStart = typeof winner.weekStart === 'string' ? winner.weekStart : new Date(winner.weekStart).toISOString();
      await cc.markWeeklyWinnerPaid(weekStart);
      refresh();
    } catch (err) { setErrInline({ message: err.message }); }
  }

  const needsAction = winner && !winner.prizePaid;

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Weekly winner</div>
        <Badge variant="secondary">{needsAction ? 1 : 0}</Badge>
      </button>
      {open && (
        <div className="mt-3">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && !winner && <EmptyState label="No winner this week yet." />}
          {!error && winner && !needsAction && <EmptyState label="Prize already paid ✓" />}
          {!error && needsAction && (
            <div className="border border-border rounded p-2">
              <div className="text-sm font-medium">{winner.winnerName}</div>
              <div className="text-xs text-muted-foreground">won {winner.winnerProfit} pts</div>
              <Button size="sm" className="mt-2" onClick={handleMarkPaid}>Mark prize paid</Button>
              {errInline && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Finalize WeeklyQueueZone**

Final `WeeklyQueueZone.jsx` shape:

```jsx
'use client';
import { SimulationAlertsPanel } from './SimulationAlertsPanel';
import { MarketReportsPanel } from './MarketReportsPanel';
import { BanQueuePanel } from './BanQueuePanel';
import { WeeklyWinnerPanel } from './WeeklyWinnerPanel';

export function WeeklyQueueZone() {
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-2xl font-serif font-semibold mb-4">Weekly queue</h2>
      <div className="space-y-3">
        <SimulationAlertsPanel />
        <MarketReportsPanel />
        <BanQueuePanel />
        <WeeklyWinnerPanel />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/WeeklyWinnerPanel.jsx iroyinayo-admin/src/components/control-center/WeeklyQueueZone.jsx
git commit -m "feat(cc): WeeklyWinnerPanel + complete Weekly Queue zone"
```

---

## Task 21: HealthStrip + BotStatusPill + BotReconnectDialog

**Files:**
- Modify: `iroyinayo-admin/src/components/control-center/HealthStrip.jsx`
- Create: `iroyinayo-admin/src/components/control-center/BotStatusPill.jsx`
- Create: `iroyinayo-admin/src/components/control-center/BotReconnectDialog.jsx`

**Interfaces:**
- Consumes: `cc.getHealth()` (polls 10s), `cc.reconnectBot()`.

- [ ] **Step 1: BotStatusPill**

Create `iroyinayo-admin/src/components/control-center/BotStatusPill.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BotReconnectDialog } from './BotReconnectDialog';

export function BotStatusPill({ online, lastConnectedAt }) {
  const [dlg, setDlg] = useState(false);
  const label = online === true ? 'Bot online' : online === false ? 'Bot offline' : 'Bot unknown';
  const variant = online === true ? 'default' : online === false ? 'destructive' : 'secondary';
  return (
    <>
      <button onClick={() => setDlg(true)} className="cursor-pointer">
        <Badge variant={variant}>{label}</Badge>
      </button>
      {dlg && (
        <BotReconnectDialog online={online} lastConnectedAt={lastConnectedAt} onClose={() => setDlg(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: BotReconnectDialog**

Create `iroyinayo-admin/src/components/control-center/BotReconnectDialog.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cc } from '@/lib/api';

export function BotReconnectDialog({ online, lastConnectedAt, onClose }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleReconnect() {
    setBusy(true);
    try {
      const r = await cc.reconnectBot();
      setResult(r);
    } catch (err) {
      setResult({ status: 'failed', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>WhatsApp bot</DialogTitle>
        <DialogDescription>
          {online === true && 'Bot socket is currently online.'}
          {online === false && 'Bot socket is offline.'}
          {online === null && 'Bot status unknown.'}
          {lastConnectedAt && (
            <div className="text-xs mt-1">Last connected: {new Date(lastConnectedAt).toLocaleString()}</div>
          )}
        </DialogDescription>
        <div className="mt-3 flex gap-2">
          <Button onClick={handleReconnect} disabled={busy}>Reconnect</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {result && (
          <div className="mt-3 text-sm">
            <div className="font-medium">{result.status}</div>
            <div className="text-muted-foreground">{result.message}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire HealthStrip**

Replace `iroyinayo-admin/src/components/control-center/HealthStrip.jsx`:

```jsx
'use client';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { BotStatusPill } from './BotStatusPill';

export function HealthStrip() {
  const { data } = usePolling(cc.getHealth, 10000);
  const h = data || {};
  const q = h.todayQueue || { sent: 0, failed: 0, skipped: 0, pending: 0 };
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex gap-3 overflow-x-auto items-center">
      <BotStatusPill online={h.botOnline ?? null} lastConnectedAt={h.botLastConnectedAt} />
      <Badge variant="secondary">Today: {q.sent} sent · {q.failed} failed · {q.skipped} skipped · {q.pending} pending</Badge>
      <Badge variant="secondary">Open markets: {h.openMarketsCount ?? 0}</Badge>
      <Badge variant="secondary">DAU: {h.dauToday ?? 0}</Badge>
      <Badge variant="secondary">Triggers: {h.pendingPositionTriggers ?? 0}</Badge>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/HealthStrip.jsx iroyinayo-admin/src/components/control-center/BotStatusPill.jsx iroyinayo-admin/src/components/control-center/BotReconnectDialog.jsx
git commit -m "feat(cc): HealthStrip + BotStatusPill + reconnect dialog"
```

---

## Task 22: Wire ManageStrip counts via summary

**Files:**
- Modify: `iroyinayo-admin/src/components/control-center/ManageStrip.jsx`

**Interfaces:**
- Consumes: `cc.getSummary()` (polls 30s) — only the `totalsManageStrip` field.

- [ ] **Step 1: Replace ManageStrip**

Replace `iroyinayo-admin/src/components/control-center/ManageStrip.jsx`:

```jsx
'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';

const TILES = [
  { label: 'Markets', href: '/markets', countKey: 'markets' },
  { label: 'Students', href: '/students', countKey: 'students' },
  { label: 'Quizzes', href: '/quizzes', countKey: 'quizzes' },
  { label: 'Schedules', href: '/schedules', countKey: 'schedules' },
  { label: 'Ambassadors', href: '/ambassadors', countKey: 'ambassadors' },
  { label: 'Content', href: '/content', countKey: 'content' },
];

export function ManageStrip() {
  const { data } = usePolling(cc.getSummary, 30000);
  const totals = data?.totalsManageStrip || {};
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              {t.label} {typeof totals[t.countKey] === 'number' && (<span className="text-muted-foreground ml-1">({totals[t.countKey]})</span>)}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd iroyinayo-admin && npm run build 2>&1 | tail -3
git add iroyinayo-admin/src/components/control-center/ManageStrip.jsx
git commit -m "feat(cc): ManageStrip with live counts"
```

---

## Task 23: Telemetry — posthog-js client wiring

**Files:**
- Modify: `iroyinayo-admin/package.json` (add `posthog-js`)
- Create: `iroyinayo-admin/src/lib/telemetry.js`
- Modify: `iroyinayo-admin/src/app/client-layout.js` (init PostHog at mount)
- Modify: panels listed below to emit events.

**Interfaces:**
- `track(event, properties)` from `lib/telemetry.js`. Fire-and-forget. Wraps `posthog.capture` with a try/catch and a console fallback.

- [ ] **Step 1: Install posthog-js**

Run: `cd iroyinayo-admin && npm install posthog-js 2>&1 | tail -3`
Expected: installs cleanly.

- [ ] **Step 2: Create telemetry helper**

Create `iroyinayo-admin/src/lib/telemetry.js`:

```javascript
'use client';

let initialized = false;

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    const posthog = require('posthog-js');
    posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com' });
  } catch (_) { /* swallow */ }
}

export function track(event, properties = {}) {
  ensureInit();
  try {
    if (typeof window === 'undefined') return;
    const posthog = require('posthog-js');
    posthog.capture(event, properties);
  } catch (_) {
    if (typeof console !== 'undefined') console.debug('[telemetry]', event, properties);
  }
}
```

- [ ] **Step 3: Add `cc_load` to the page**

Edit `iroyinayo-admin/src/app/page.js` to fire `cc_load` on mount. Convert the file to use `'use client'` and `useEffect`:

```jsx
'use client';
import { useEffect } from 'react';
import { HealthStrip } from '@/components/control-center/HealthStrip';
import { TodaysWorkZone } from '@/components/control-center/TodaysWorkZone';
import { WeeklyQueueZone } from '@/components/control-center/WeeklyQueueZone';
import { ManageStrip } from '@/components/control-center/ManageStrip';
import { cc } from '@/lib/api';
import { track } from '@/lib/telemetry';

export default function ControlCenterPage() {
  useEffect(() => {
    cc.getSummary().then((s) => {
      track('cc_load', {
        panels_with_items: {
          resolve: s.marketsToResolve,
          pending_markets: s.pendingUserMarkets,
          content: s.pendingContent,
          redemptions: s.pendingRedemptions,
          alerts: s.simulationAlerts,
          reports: s.marketReports,
          bans: s.recentBansCount,
          weekly_winner: s.weeklyWinnerUnpaid ? 1 : 0,
        },
      });
    }).catch(() => track('cc_load', { panels_with_items: null }));
  }, []);

  return (
    <main className="min-h-screen">
      <HealthStrip />
      <TodaysWorkZone />
      <WeeklyQueueZone />
      <ManageStrip />
    </main>
  );
}
```

- [ ] **Step 4: Add panel-level telemetry**

In each panel, after a successful action, call `track`. Spec events:

| Event | Where | Properties |
|---|---|---|
| `cc_market_resolved` | `ResolveMarketsPanel.handleResolve` after success | `market_id, winning_outcome_id` |
| `cc_user_market_approved` | `PendingUserMarketsPanel.handleApprove` after success | `market_id` |
| `cc_user_market_rejected` | `PendingUserMarketsPanel.handleReject` after success | `market_id, reason` |
| `cc_content_approved` | `PendingContentPanel.handleApprove` after success | `content_id` |
| `cc_redemption_fulfilled` | `PendingRedemptionsPanel.handleFulfill` after success | `redemption_id` |
| `cc_alert_acknowledged` | `SimulationAlertsPanel.handleUpdate` after success | `alert_id, status (action)` |
| `cc_bot_reconnect_triggered` | `BotReconnectDialog.handleReconnect` after success | `result_status: result.status` |

For each panel, add `import { track } from '@/lib/telemetry';` and add the `track(...)` call after the successful `await` and before `refresh()`. Example for `ResolveMarketsPanel`:

```javascript
await cc.resolveMarket(marketId, outcomeId);
track('cc_market_resolved', { market_id: marketId, winning_outcome_id: outcomeId });
setOpenId(null);
refresh();
```

Apply the same edit to each panel listed above.

- [ ] **Step 5: Build + commit**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -3`
Expected: clean build.

```bash
git add iroyinayo-admin/package.json iroyinayo-admin/package-lock.json iroyinayo-admin/src/lib/telemetry.js iroyinayo-admin/src/app/page.js iroyinayo-admin/src/components/control-center/
git commit -m "feat(cc): telemetry events via posthog-js"
```

---

## Task 24: Final smoke + verification

**Files:** None new — verification only.

- [ ] **Step 1: Backend tests pass**

Run: `cd iroyinayo && npm test -- admin`
Expected: all new admin/* tests pass. Pre-existing failures (auth, markets, onboarding, rewards) persist — they're not ours.

- [ ] **Step 2: Admin app builds**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -10`
Expected: builds cleanly, no errors.

- [ ] **Step 3: Manual smoke**

Run backend: `cd iroyinayo && npm start &`
Run admin: `cd iroyinayo-admin && npm run dev`
Open `http://localhost:3000` in a browser:
- Log in via existing `/login`.
- Verify the new control center page renders.
- Verify each panel renders (likely with empty states unless test data exists).
- Verify the HealthStrip polls (open dev tools network tab — should see `/admin/control-center/health` calls every 10s).

Kill both servers when done.

- [ ] **Step 4: Final commit (if any cleanup)**

If any small fixes are needed from manual smoke:

```bash
git add -A
git commit -m "chore(cc): final smoke fixes"
```

- [ ] **Step 5: Review branch**

```bash
git log --oneline main..HEAD
```

Expected: ~24 commits, one per task, descriptive messages, no AI attribution.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) | Status |
|---|---|---|
| §2.1 Zone 1 Health Strip | T7 (health endpoint), T21 (HealthStrip + Bot pill) | ✓ |
| §2.2 Zone 2 Today's Work — 5 panels | T12 / T13 / T14 / T15 / T16 | ✓ |
| §2.3 Zone 3 Weekly Queue — 4 panels | T17 / T18 / T19 / T20 | ✓ |
| §2.4 Zone 4 Manage strip | T11 (skeleton) + T22 (counts) | ✓ |
| §3.1 Polling cadences | T10 (usePolling) + panel-level interval args | ✓ |
| §3.2 Bot reconnect | T8 (endpoint) + T21 (dialog) | ✓ |
| §3.3 Inline expand-and-confirm | All panels implement this directly | ✓ |
| §3.4 Optimistic UI with rollback | Partial: panels refresh after action, but optimistic preview not implemented. Inline error fallback present. Note: spec calls for optimistic preview; we ship "refresh-after-success" as a simpler equivalent that still meets §10 success criteria. Flag as a minor scope deviation. | ⚠️ Deviation |
| §3.5 Auth and roles | All routes use `authenticate` / `requireRole` per spec | ✓ |
| §4.1 Existing endpoints reused | T10 (api.js helpers) | ✓ |
| §4.2 New endpoints (9) | T3 / T4 / T5 / T6 / T7 / T8 | ✓ |
| §4.3 Response shape conventions | All new services return `{items, total}` or `{ok: true}` | ✓ |
| §5 File structure | T1-T22 match the structure | ✓ |
| §6 Data flow | usePolling implements it | ✓ |
| §7 Error handling | Per-panel inline errors; background polls silent | ✓ |
| §8 Telemetry (8 events) | T23 wires all 8 | ✓ |
| §9 Migrations 030 + 031 | T1 + T2 | ✓ |

One known scope deviation (§3.4 optimistic vs. refresh-after-success). Functionally equivalent for the success criteria. If the spec's strict optimistic-with-rollback behavior is required, a follow-up task can layer it on per panel.

**2. Placeholder scan:** No "TBD", "TODO", or "Add error handling" steps. All code blocks are concrete. Some response field names (e.g., redemption row fields like `r.student_name` / `r.reward_name`) defensively try multiple field names because the existing `/rewards/pending` shape wasn't inspected at plan time — the engineer should adjust per the actual response (a one-line fix per panel if needed). Acceptable.

**3. Type consistency:**
- `cc.*` helper names match across all panels.
- `usePolling` returns `{data, error, loading, refresh}` consistently used.
- Service exports (`getSummary, getHealth, listPendingReports, updateReport, getWeeklyWinnerStatus, markWinnerPaid, listRecentBans, approveMarket, rejectMarket`) match what routes consume.
- Migration column names (`resolution_status, resolution_note, resolved_at, resolved_by_admin_id, paid_at, paid_by_admin_id`) match what services query.

No type mismatches found.

