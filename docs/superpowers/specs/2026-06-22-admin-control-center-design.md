# Admin Control Center — Design Spec

**Date:** 2026-06-22
**Status:** Draft, awaiting review
**Scope:** The admin home page in `iroyinayo-admin` becomes a layered "control center" that surfaces the operational queues an admin must clear daily/weekly, with inline one-click actions and 30-second polling. This spec covers the control center page itself; the AI Market Creator that plugs into one of its panels is a separate follow-up (Spec 2).

---

## 1. Product thesis

IroyinMarket has accumulated 10+ admin-touchable surfaces (markets, students, redemptions, content, simulation alerts, reports, bot health, weekly winner, ambassadors, quizzes, schedules, liquidity config) spread across the admin app. The existing dashboard is read-only — it shows stats, but the actual operational work happens on separate pages the admin must navigate to.

The control center collapses the daily operational rhythm into one screen: open it in the morning, see what needs doing, act inline, leave when every panel reads "All clear ✓". It is not a redesign of the admin app — it is a single page that becomes the new home, with the existing pages preserved for deeper editing.

## 2. Information architecture — four zones

The page is divided into four vertically stacked zones. Each zone has one clear job.

### 2.1 Zone 1 — System Health Strip (sticky)

Always visible, ~100px tall, sticks to the top of the viewport on scroll. Five status pills laid out horizontally:

| Pill | Source | Cadence |
|---|---|---|
| **WhatsApp bot** | Baileys socket connected? Last connect timestamp. | Polled every 10s. Clickable — opens reconnect dialog. |
| **Today's WhatsApp send** | Counts from `whatsapp_daily_queue` for today: sent / failed / skipped / pending. | Polled every 30s. |
| **Open markets** | `COUNT(*) FROM multi_markets WHERE status = 'open'`. | Polled every 30s. |
| **Active users today** | `COUNT(*) FROM students WHERE last_app_open_at >= today_start_wat`. | Polled every 30s. |
| **Habit triggers eligible** | `COUNT(*) FROM position_triggers WHERE fired_at IS NULL`. | Polled every 30s. |

Each pill is clickable. The bot pill opens a reconnect dialog (§3.2). The other four open a small drill-down modal showing recent records (last 20 rows) — useful for spot-checking the underlying data.

### 2.2 Zone 2 — Today's Work (primary action surface)

A 2-column grid (1-column on mobile under 768px) of five panels. Each panel is a `Card` with a header (panel title + count badge) and an inline list of items with inline action buttons.

1. **Markets to resolve.** Closed-but-unresolved multi-markets. Each row shows market title, close time, total volume, and outcome buttons (one per outcome). Tapping an outcome expands the row to show a confirm button + "Cancel". Confirm calls `POST /multi-markets/:id/resolve`.

2. **User-created markets pending approval.** Multi-markets with `status='pending'` (created via `POST /multi-markets/create` by users). Each row shows title, creator name, outcomes, and creator's accuracy stat. Inline Approve / Reject buttons. Reject opens a 1-line reason input. Approve calls `POST /multi-markets/:id/approve` (new endpoint). Reject calls `POST /multi-markets/:id/reject` (new endpoint).

3. **Daily content awaiting approval.** Items from `GET /content/pending`. Each row shows generated title + 2-line preview. Approve (`POST /content/:id/approve`) and Publish (`POST /content/:id/publish`) inline. Time-pressure: items unapproved by 7:30am WAT render with a 3px ochre left border (per DESIGN.md's toast-style accent treatment) signalling urgency — the 8am cron will send the digest with or without them.

4. **Pending redemptions.** From `GET /rewards/pending`. Each row shows user name, reward name, points value, redemption timestamp. Inline "Mark fulfilled" button + optional notes field. Calls `POST /rewards/:id/fulfill`.

5. **Create market with AI** *(Spec 1 placeholder)*. Renders a card the same size as the other panels with copy: *"Coming soon. Spec 2 will enable AI-assisted market drafting from text prompts or RSS trends."* The card has a disabled CTA. When Spec 2 ships, this placeholder is replaced with the real component. The placeholder exists in Spec 1 so the layout doesn't reflow when Spec 2 lands.

**Empty state per panel.** When the panel's list is empty, render `All clear ✓` in Fraunces serif, accent-green color. The control center on a fully-cleared day shows five green checkmarks in Zone 2 and a collapsed Zone 3.

### 2.3 Zone 3 — Weekly Queue (collapsible)

Four collapsible panels. Each panel's header shows a count badge. **Default-collapsed when count is 0; default-expanded when count > 0.**

1. **Simulation alerts.** `GET /simulation/alerts?status=pending`. Each row shows market title, alert type (manipulation / stuck / early_resolution), severity (low / medium / high — color-coded badges). Inline Acknowledge / Dismiss / "View market" actions. Acknowledge / Dismiss call `PATCH /simulation/alerts/:id`.

2. **Market reports.** `GET /admin/market-reports` (new endpoint). Each row shows market title, reporter name, reason text, timestamp. Inline Dismiss / Resolve. Resolve also opens the market for review.

3. **Recent bans.** Lists users banned in the last 7 days from `GET /admin/students/banned` (new endpoint). Each row shows user name, ban reason (if recorded), banned-at timestamp, and the admin who banned them. Inline "Unban" button (`POST /admin/students/:id/unban`). "Investigate" deep-link to `/students/:id` for full context. (Users flagged via market reports surface in the Market Reports panel above this one — they do not duplicate here.)

4. **Weekly leaderboard winner.** From `GET /admin/weekly-winner-status` (new endpoint). If the current week's winner has `prize_paid = false`, the panel shows the winner with a "Mark prize paid" button calling `POST /admin/weekly-winner/:weekStart/mark-paid` (new endpoint).

### 2.4 Zone 4 — Manage (bottom strip)

A horizontal row of small card-tiles deep-linking to existing pages. Each tile shows the page name and a count of total items in that section (not pending — total):

`Markets (n)`, `Students (n)`, `Quizzes (n)`, `Schedules (n)`, `Ambassadors (n)`, `Liquidity config (n)`, `Content library (n)`

The counts are computed by the `/control-center/summary` endpoint (totals per table). No new functionality — these are deep links. The control center NEVER reimplements an existing page's functionality, only routes to it.

## 3. Behaviors

### 3.1 Polling

- `/admin/control-center/health` — every 10s. Drives Zone 1's bot pill and the live counters.
- `/admin/control-center/summary` — every 30s. Drives the count badges on Zone 2 and Zone 3 panels.
- Per-panel detail fetches — on panel mount and on user action only. Not polled. Tapping into a panel always fetches fresh data, so a 30s-stale badge is acceptable.

Each panel manages its own polling lifecycle via a shared `usePolling` hook. No global orchestrator.

### 3.2 Bot reconnect

Clicking the bot pill opens a small `Dialog`. The dialog shows the current state (online / offline / last error) and a "Reconnect" button. Tapping calls `POST /admin/bot/reconnect` (new endpoint). The endpoint returns `{status: 'reconnecting' | 'already_connected' | 'failed', message}` and the dialog updates inline.

### 3.3 Inline expand-and-confirm

For actions that need context (resolving a market requires picking an outcome; rejecting a market needs a reason), the row expands inline with the action UI. Tapping outside collapses without firing the action. This avoids modal pop-overs for routine work.

Modal dialogs are used only for the bot reconnect and for drill-down detail views from Zone 1 pills.

### 3.4 Optimistic UI with rollback

The moment the admin clicks an action button, the panel updates as if the action succeeded (the row disappears from the list, the count badge decrements). The POST fires in parallel. On success: nothing further happens — the optimistic state is now authentic. On error: the row reappears, an inline error message is rendered inside the panel ("Couldn't resolve market — please retry"), and the action button re-enables.

The user never sees a spinner blocking the click. The user never sees a global toast for control-center actions — errors are inline within the panel.

### 3.5 Auth and roles

Admin auth uses the existing JWT flow (`/admin/login`). The control center page is gated by the same `authenticate` middleware as every other admin page.

Per-action role check:
- All read endpoints (`/control-center/summary`, `/control-center/health`, lists) — any authenticated admin (super_admin / moderator). Moderators see exactly the same data and panels as super_admins.
- Destructive actions (`approve`, `reject`, `ban`, `unban`, `mark-paid`, `bot/reconnect`) — `requireRole('super_admin', 'moderator')` per the existing pattern. Note: the existing pattern already grants `moderator` access to all destructive actions used here, so role-gated buttons are visible to both roles.

If a future role (e.g., `viewer`) is added that lacks one of these capabilities, that role's forbidden buttons render disabled with a small `(super-admin only)` tooltip rather than firing a 401. v1 has no such role, so all role-gating in v1 is server-side only.

## 4. API surface

### 4.1 Existing endpoints reused (no backend changes)

| Surface | Endpoint |
|---|---|
| List markets by status | `GET /multi-markets/admin/all?status=closed\|pending\|open` |
| Resolve market | `POST /multi-markets/:id/resolve` body `{winningOutcomeId}` |
| List pending content | `GET /content/pending` |
| Approve / publish content | `POST /content/:id/approve` ; `POST /content/:id/publish` |
| Pending redemptions | `GET /rewards/pending` |
| Fulfill redemption | `POST /rewards/:id/fulfill` |
| Simulation alerts list | `GET /simulation/alerts?status=pending` |
| Acknowledge / dismiss alert | `PATCH /simulation/alerts/:id` body `{status}` |
| Ban / unban student | `POST /admin/students/:id/ban` ; `POST /admin/students/:id/unban` |
| Dashboard KPIs | `GET /admin/dashboard-kpis` |
| Analytics | `GET /admin/analytics` |

### 4.2 New endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /admin/control-center/summary` | One call returns counts for all panels: `{ marketsToResolve, pendingUserMarkets, pendingContent, pendingRedemptions, simulationAlerts, marketReports, recentBansCount, weeklyWinnerUnpaid: boolean }`. | `authenticate` |
| `GET /admin/control-center/health` | Returns the health strip: `{ botOnline, botLastConnectedAt, todayQueue: {sent, failed, skipped, pending}, openMarketsCount, dauToday, pendingPositionTriggers }`. | `authenticate` |
| `GET /admin/market-reports` | List pending market reports with reporter, market, reason, timestamp. | `authenticate` |
| `PATCH /admin/market-reports/:id` body `{action: 'dismiss' \| 'resolve', resolution_note?}` | Update a report. | `requireRole('super_admin','moderator')` |
| `GET /admin/weekly-winner-status` | Returns current week's winner with `prize_paid` flag. | `authenticate` |
| `POST /admin/weekly-winner/:weekStart/mark-paid` | Flip `prize_paid` to true; record `paid_at` and `paid_by_admin_id`. | `requireRole('super_admin','moderator')` |
| `POST /multi-markets/:id/approve` | Approve a user-created market (status `pending` → `open`). | `requireRole('super_admin','moderator')` |
| `POST /multi-markets/:id/reject` body `{reason}` | Reject a user-created market (status `pending` → `rejected`). Store reason. | `requireRole('super_admin','moderator')` |
| `POST /admin/bot/reconnect` | Trigger a manual Baileys reconnect. Returns `{status, message}`. | `requireRole('super_admin','moderator')` |
| `GET /admin/students/banned` | List students banned in the last 7 days with reason, banned-at, banning admin. | `authenticate` |

### 4.3 Response shape conventions

- Lists return `{ items: [...], total: number }`. No pagination in v1 — admin queues are expected to be small.
- Mutations return `{ ok: true }` or `{ ok: false, error: string }`. Matches the existing `api.post()` helper in `iroyinayo-admin/src/lib/api.js`.
- Counts in summary/health are integers; the client never does arithmetic on the response.

## 5. Frontend file structure

### 5.1 New files

```
iroyinayo-admin/src/
├── app/
│   └── page.js                          # REWRITTEN: renders the four zones. ~80 lines.
├── components/
│   └── control-center/
│       ├── HealthStrip.jsx              # Zone 1, polls 10s
│       ├── BotStatusPill.jsx
│       ├── BotReconnectDialog.jsx
│       ├── TodaysWorkZone.jsx           # Zone 2 wrapper, 5 panels
│       ├── ResolveMarketsPanel.jsx
│       ├── PendingUserMarketsPanel.jsx
│       ├── PendingContentPanel.jsx
│       ├── PendingRedemptionsPanel.jsx
│       ├── AIMarketCreatorPanel.jsx     # Placeholder card in Spec 1
│       ├── WeeklyQueueZone.jsx          # Zone 3 wrapper, 4 collapsible panels
│       ├── SimulationAlertsPanel.jsx
│       ├── MarketReportsPanel.jsx
│       ├── BanQueuePanel.jsx
│       ├── WeeklyWinnerPanel.jsx
│       ├── ManageStrip.jsx              # Zone 4
│       └── usePolling.js                # Shared hook: usePolling(fetchFn, intervalMs)
```

### 5.2 New backend files

```
iroyinayo/src/modules/admin/
├── controlCenter.routes.js              # /admin/control-center/summary, /health
├── controlCenter.service.js
├── marketReports.routes.js
├── marketReports.service.js
├── weeklyWinner.routes.js
├── weeklyWinner.service.js
└── bot.routes.js                        # /admin/bot/reconnect
```

### 5.3 Files modified (small touches)

| File | Change |
|---|---|
| `iroyinayo-admin/src/app/page.js` | Rewritten from 280-line stats dashboard to ~80-line control center. The stats/leaderboard previously shown are now absorbed into Zone 1's drill-down modals. |
| `iroyinayo-admin/src/lib/api.js` | Add helpers: `getControlCenterSummary`, `getControlCenterHealth`, `getMarketReports`, `updateMarketReport`, `getWeeklyWinnerStatus`, `markWeeklyWinnerPaid`, `approveMarket`, `rejectMarket`, `reconnectBot`. |
| `iroyinayo-admin/package.json` | Add `posthog-js` dependency for telemetry. |
| `iroyinayo/src/app.js` | Register the four new route modules. |
| `iroyinayo/src/modules/markets/multiMarkets.routes.js` | Add `POST /:id/approve` and `POST /:id/reject`. |
| `iroyinayo/migrations/030_add_market_report_resolution.js` (NEW) | Adds `resolution_status`, `resolution_note`, `resolved_at`, `resolved_by_admin_id` columns to `market_reports` so the PATCH endpoint has something to write. |
| `iroyinayo/migrations/031_add_weekly_winner_paid_metadata.js` (NEW) | Adds `paid_at` and `paid_by_admin_id` columns to `weekly_leaderboards`. |

## 6. Data flow per panel (uniform pattern)

```
Mount → useStateInit → usePolling(fetchPanelData, intervalMs)
   ↓                              ↑ every 30s
fetch → success → setState        |
   ↓                              |
state → render                    |
   ↓                              |
user action → optimistic UI update → POST/PATCH → success → refresh()
                ↓ on error
              roll back optimistic state → show inline error in panel
```

## 7. Error handling

- **Per-panel isolation.** A failing endpoint affects only that panel. Other panels remain functional.
- **Background poll errors are silent.** A failed background poll leaves the panel showing its last-known data. Errors surface only on user-initiated actions and on initial load.
- **Auth failures (401)** are handled by the existing `api.js` global handler — token cleared, page reloaded to login.
- **Concurrent admin actions.** If two admins act on the same item simultaneously, the second one gets a stale-state error. The panel refreshes and surfaces "This item was just updated by another admin" inline.
- **Network offline.** Polling continues silently. When the network returns, the next tick succeeds and the UI updates.

## 8. Telemetry

Eight events, emitted client-side via `posthog-js`. No new backend telemetry — the backend already emits its own events through the existing PostHog SDK.

| Event | When | Properties |
|---|---|---|
| `cc_load` | On initial page mount | `panels_with_items: {resolve: n, pending_markets: n, content: n, redemptions: n, alerts: n, reports: n, bans: n, weekly_winner: 0|1}` |
| `cc_market_resolved` | After successful resolve | `market_id`, `winning_outcome_id`, `time_since_market_close_h` |
| `cc_user_market_approved` | After approve | `market_id`, `creator_id` |
| `cc_user_market_rejected` | After reject | `market_id`, `creator_id`, `reason` |
| `cc_content_approved` | After approve | `content_id` |
| `cc_redemption_fulfilled` | After fulfill | `redemption_id`, `reward_id` |
| `cc_alert_acknowledged` | After acknowledge or dismiss | `alert_id`, `alert_type`, `severity`, `action` |
| `cc_bot_reconnect_triggered` | After reconnect tap | `result_status` (returned by the endpoint) |

## 9. Data model changes

Two new migrations. No new tables.

### 9.1 `030_add_market_report_resolution.js`

Adds to `market_reports`:

| Column | Type | Notes |
|---|---|---|
| `resolution_status` | enum (`pending`, `dismissed`, `resolved`) default `pending` | Default value backfills existing rows. |
| `resolution_note` | text nullable | Admin's note when resolving. |
| `resolved_at` | timestamptz nullable | |
| `resolved_by_admin_id` | uuid FK → admins(id) nullable | |

### 9.2 `031_add_weekly_winner_paid_metadata.js`

Adds to `weekly_leaderboards`:

| Column | Type | Notes |
|---|---|---|
| `paid_at` | timestamptz nullable | |
| `paid_by_admin_id` | uuid FK → admins(id) nullable | |

The `prize_paid` boolean already exists.

## 10. Success criteria

Operational targets for the first 14 days post-launch:

1. **Time-to-clear** (median minutes from the day's first action to all five Zone-2 panels showing "All clear") under 10 minutes on a typical day. Load-bearing metric.
2. **Daily admin login rate**: at least one admin logs into the control center every day. Measured by `cc_load` events.
3. **Action completion rate** ≥95% (action button tap → success, no rollback). Measures backend reliability under the new aggregation.
4. **Zero "8am send with unapproved content"** incidents. Currently the `0 8 * * *` cron sends regardless of approval; the control center's panel surfaces unapproved items ahead of time. Metric: `% of days where 8am send occurred AFTER admin marked the day's content approved`.
5. **Page render p95 under 2 seconds** on 3G. Aggregation endpoint must be fast (single round-trip).

## 11. Out of scope for Spec 1 (explicit)

- AI Market Creator (entire feature; ships as Spec 2 plugging into the placeholder panel).
- RSS trend scanner (Spec 2).
- Real-time Socket.io updates. Polling at 10s / 30s is sufficient.
- Pagination on panels. Defer until a panel exceeds 20 items in production.
- Multi-admin presence indicators ("Bola is also looking at this market").
- Mobile-app-specific layout. Responsive web is enough for v1.
- Custom panel ordering / hide-show controls.
- Bulk actions ("resolve 5 markets at once").
- Audit log of who-did-what. (Data exists on `admins` and now on the two new metadata columns; surfacing as an admin UI is a follow-up.)
- Per-admin per-panel notification preferences.

## 12. Risk register

| Risk | Mitigation |
|---|---|
| Aggregation endpoint slow under load | Each count is a single `SELECT COUNT(*)` against indexed columns; should be <50ms p95. If not, cache for 10s server-side. |
| Polling load grows with admin team | At 10 admins polling every 10s on `/health`, that's ~1 req/s — trivial. Re-evaluate at admin count > 50. |
| Bot reconnect endpoint may not have a Baileys session to revive | Endpoint returns a useful status (`reconnecting` / `already_connected` / `failed`) plus message; admin sees the result inline. |
| Panel layout breaks on small phones | Tested-not-promised: responsive in CSS, but the primary audience is desktop. Mobile is best-effort. |
| User-created markets with abusive titles slip through quick approve | The panel shows full title + outcomes + creator name. A reject-with-reason flow is one extra tap. Admins are expected to read before approving. |
| Optimistic UI desyncs from server state | The panel refreshes after each mutation; the optimistic step is only the immediate visual response. The next refresh reconciles. |
| Concurrent admins approve the same item | Server returns a 409 / stale-state response; panel handles by refreshing and showing inline notice. |

