# Habit Loop — Design Spec

**Date:** 2026-06-21
**Status:** Draft, awaiting review
**Scope:** Spine of a habit-forming loop for IroyinMarket, derived from Nir Eyal's *Hooked*, BJ Fogg's *Tiny Habits* (B = MAT), and Charles Duhigg's *The Power of Habit*. First ship only — amplifiers (market groups, follow graph, web push, accuracy-title rework) are explicitly deferred.

---

## 1. Product thesis

IroyinMarket's core retention metric is daily prediction frequency. The product already has the *reward* infrastructure of a habit-forming product (predictions, odds, leaderboard, gamification, real-time updates), but it lacks the *trigger* and *investment* infrastructure that turns sporadic visits into automatic behavior. This project builds those two phases.

The intent is not to "gamify" the product more. DESIGN.md positions IroyinMarket as warm-editorial, with the line "your accuracy IS your reputation." This spec reinforces that positioning by making accuracy the load-bearing investment object and avoiding streak/XP/level mechanics that reward showing up over being right.

## 2. The loop

| Phase (Eyal / Duhigg / Fogg) | What it is in IroyinMarket |
|---|---|
| **Trigger / Cue** | Daily WhatsApp message at a consistent local time window. Lede is the strongest available personal signal (rank change → resolution today → social → curiosity fallback). |
| **Action / Routine** | Smart-split deep link. Specific-market ledes land on that market with default stake selected. General ledes land on the markets page with a personalized top strip. Target: <10s from tap to predicted on 3G. |
| **Variable Reward** | Layered reveal sheet: acknowledgement (always), market-impact animation (always, magnitude varies), social ticker (probabilistic, ~30%). Three Eyal reward flavors — hunt, tribe, self. |
| **Investment** | Each prediction feeds public accuracy reputation on profile, and creates an open position that fires its own future trigger. Stored value the user cannot recreate elsewhere. |
| **Internal trigger** | Over weeks, "I wonder what's happening on IroyinMarket" replaces the WhatsApp ping. Measured by % of daily sessions originating from direct visits vs. deep link. |

**Out of scope for this ship.** Market groups, follow graph, web push notifications, accuracy-title rework. All deferred to follow-up specs. Backend module rename (`students` → `users`) also deferred — this spec uses "users" / "predictors" in public-facing language only.

## 3. Trigger — daily WhatsApp message

**Channel.** WhatsApp via Baileys (existing bot, unofficial WhatsApp Web library). Baileys does not require WhatsApp-approved templates, so free-form text is allowed, but anti-spam discipline becomes critical because WhatsApp's anti-abuse systems will silently ban Baileys accounts that look like spam software.

**One message per user per day**, sent within a morning window. No batching of multiple updates into a single message; no second send unless the strict event-trigger rules in §6 apply.

### 3.1 Send timing

- **Window:** 7:00am–9:30am West Africa Time.
- **Anchor time per user:** chosen by a uniform random pick inside the window at the moment the user becomes eligible for the daily send (i.e., when `wa_daily_enabled` flips to true — see §7.1). Written once and not changed thereafter. Acts as the user's "morning slot."
- **Daily jitter:** every day's actual send fires at `anchor_time ± uniform(0, 25min)`. A user with a 7:48 anchor might receive at 7:32 one day and 8:11 the next. Preserves Duhigg's "consistent context" (always the morning) without a fingerprintable exact minute.
- **Server pacing:** global throughput cap of 1 message every 4–8 seconds (randomized), with a longer pause (~30–60s) every 50 messages. Send order is shuffled, not sorted by signup date or user ID. A several-thousand-user blast becomes a multi-hour drip.

### 3.2 Message structure

A single template with four slots, picked deterministically:

```
{greeting}, {firstName}.

{lede}
{markets_line}
{cta}
```

**Greeting** rotates from a small pool (`Good morning` / `Morning` / `Hey` / `Good morning oh`), chosen deterministically per user per day. The same user does not see a different greeting day-to-day; the fleet of outgoing messages is not uniform. Subtle punctuation/emoji variation across pool entries breaks exact-text deduping at WhatsApp's end without feeling gimmicky.

**Lede priority** (first match wins; always exactly one lede):

| Priority | Condition | Example lede |
|---|---|---|
| 1 | User's leaderboard rank moved ≥3 positions since previous day | `You're rank #47 — up 5 since yesterday.` |
| 2 | User has ≥1 open position resolving in the next 24h | `2 of your calls resolve today.` |
| 3 | A user this user has predicted alongside (same market, same side, within previous 7 days) just placed a new prediction in the previous 12h | `Someone you predicted with just called UNILAG-OAU.` |
| 4 | Curiosity fallback — most-traded market in the previous 24h | `Will UNILAG beat OAU Saturday? 1,247 in.` |

If the user qualifies for none of priorities 1–3 *and* there is no clear curiosity market (no market with >50 predictions in the last 24h), the daily send is skipped for that user that day. Skipping a day is preferable to forcing a low-quality cue.

**Markets line.** 2–3 markets, ranked by: (a) any market named in the lede, (b) markets in categories where the user has predicted in the last 14 days, (c) trending markets the user hasn't touched. Format: `MarketName · current_odds · resolves_in`. Comma-separated.

**CTA.** Single deep link to the chosen landing surface (see §4), formatted as `Open IroyinMarket →`.

### 3.3 Recipient hygiene and deliverability

- **Eligibility prerequisite:** a user is only enrolled in the daily send after they have sent at least one message to the bot. The web onboarding flow includes a "say hi to the bot to enable daily updates" step. Messaging non-contacts is the strongest WhatsApp spam signal and the fastest path to account ban.
- **Skip same-day if recently active:** if the user has opened the web app within the previous 4 hours of their scheduled send, skip that day. The cue is redundant and risks irritation.
- **Pause-for-7-days inline reply:** the message includes an instruction line — "Reply PAUSE to pause for 7 days." A `PAUSE` reply suppresses sends for 7 days, then auto-resumes. Suppression is not silently extended.
- **STOP reply:** hard-removes from the daily send list. Re-enrollment requires explicit re-opt-in via the web app.
- **Failure handling:** Baileys errors (number not on WhatsApp, blocked, send rejected) increment a per-user failure counter. After 2 consecutive failures, the user is paused; a re-verify prompt surfaces the next time they open the web app.

### 3.4 Account survival

- All scheduled sends are persisted in `whatsapp_daily_queue` with columns: `user_id`, `scheduled_for` (timestamp), `lede_type`, `status` (enum: `pending | sent | failed | skipped`), `attempts`, `last_error`. The queue is the source of truth — if the Baileys session drops, the queue waits.
- If the Baileys connection reconnects and a queued message's scheduled time has passed by more than 90 minutes, the message is **dropped, not back-filled**. A late-morning or evening "good morning" is worse than no message.
- **Health monitor:** if >5% of sends in a 1-hour window fail, the entire daily run pauses and an admin alert fires. Better to skip a day than burn the bot account.
- **No multi-account rotation in this ship.** Single well-behaved Baileys account. Multi-account sending pools are deferred.

### 3.5 Deep-link tracking

Every deep link in a daily message carries:
```
?ref=wa_daily&lede={rank|resolution|social|curiosity}&market={id?}
```

`ref` is persisted on the resulting position record (new column, §7.3). This is how lede effectiveness is measured.

## 4. Action — smart-split landing

**Goal.** From WhatsApp tap to "prediction placed" in under 10 seconds on 3G. Per Fogg's B = MAT: motivation is high at the cue; ability must not drop below the trigger threshold.

### 4.1 Landing surface by lede

| Lede on WhatsApp | Landing surface |
|---|---|
| Rank change | `/markets` with a personalized strip at the top — "Markets you might call" — containing the 3 markets from the message's `markets_line`, prefilled. |
| Resolution today | `/markets/{id}` for the resolving market the user already has a position on. Page is scrolled to their position and shows a one-tap "Add to position" button. |
| Social ("someone you predicted with") | `/markets/{id}` for that specific market, in quick-predict mode (see §4.3). |
| Curiosity | `/markets/{id}` for the curiosity market named in the lede, in quick-predict mode. |

**Rule.** The market named in the WhatsApp message is the market the link opens on. No interstitials, no markets feed in between. Betraying the cue's promise kills the loop.

### 4.2 Default stake

A single-tap predict needs a stake preselected. Rules:

- Default = the user's median stake from their last 10 predictions, rounded to the nearest 50 points.
- **Floor:** 100 points. **Ceiling:** the lesser of 1,000 points or 10% of current balance. Caps prevent one-tap predictions from blowing up a balance.
- Users with fewer than 3 historical predictions get a flat 200 points.
- The default is visible and adjustable via a stepper in two taps. Default is a suggestion, not a trap.
- If the user's current balance is below the default-stake floor, the stake auto-shrinks to the largest allowed value and renders in the ochre highlight color (per DESIGN.md) with a small "max" pill. The predict path is never blocked by insufficient balance — only by zero balance.

### 4.3 Quick-predict render mode

The existing `MarketDetail` page accepts a render-mode flag triggered by `?ref=wa_daily`. For the first 30 seconds after landing (or until the user predicts, whichever first):

- Outcome buttons enlarged (per DESIGN.md 44px minimum, but visually scaled to ~64px on mobile).
- Stake stepper pre-selected with the default value.
- "Predict" CTA pinned to the bottom of the viewport.
- Supporting content (chart, comments, market description) collapsed below the fold.
- After predict (or 30s timeout), page reverts to normal `MarketDetail` rendering.

No new route, no new page. A render-mode flag on the existing component.

### 4.4 Prediction flow

- Tap 1: outcome (YES/NO or A/B).
- Tap 2: "Predict" — fires the prediction.
- (Optional taps 2–3 if adjusting stake via the stepper, then tap 4 is "Predict".)
- **No confirmation dialog.** The layered reveal (§5) is the confirmation.
- Existing `POST /api/markets/:id/predict` endpoint receives `{outcome, stake, ref}`. The `ref` field is new and is persisted on the position row.
- The UI updates **optimistically.** The reveal animation begins immediately on tap. On server rejection (e.g., market closed in the last few seconds, insufficient balance after auto-shrink failed), the optimistic state rolls back and an inline error is shown inside the reveal sheet — not a toast.

### 4.5 Edge cases

- **Market closed/resolved between WhatsApp send and tap.** Land on the market in read-only mode with a single banner: "This market resolved." If the user had a prior position, P&L is the first thing they see — variable reward, not a wasted trip.
- **User logged out (new device, cleared cookies).** Deep link routes to login. Login completes and redirects to the original deep-link target with all params preserved.
- **Late tap (hours after send).** Deep link does not expire. Market may have moved, but the user's decision is theirs. Quick-predict mode still applies for 30 seconds.

## 5. Variable Reward — layered reveal

**Goal.** Turn the moment a prediction is placed from a static confirmation into a three-beat sequence where at least one beat is non-deterministic in *form*. Eyal: rewards must vary in form, not just outcome.

The reveal renders as a single bottom sheet that slides up from the predict CTA. Sheet uses `shadow-float` per DESIGN.md. Sheet does not navigate; the underlying market page (now updated) remains beneath.

### 5.1 Beat 1 — Acknowledgement (always fires, ~250ms)

- Fraunces serif headline: `Predicted.`
- Outcome chosen, stake, projected payout if correct (mono).
- No confetti, no celebratory sound. Per DESIGN.md, this is editorial restraint, not arcade.
- This beat is the predictable anchor — Duhigg's research is that the cue→reward loop needs *some* certainty to learn against.

### 5.2 Beat 2 — Market impact (always fires, ~600ms; content varies)

A horizontal odds bar animates from pre-prediction to post-prediction position. The delta is rendered as a mono number with a green color flash. Three visual states based on impact size:

| State | Δ (percentage points) | Treatment |
|---|---|---|
| Negligible | <0.5 | Bar nudges, no number callout |
| Notable | 0.5–3 | Bar slides visibly, mono number flashes |
| Sharp | >3 | Bar slides, number flashes, ochre "Sharp move" pill appears |

The user cannot predict the state until the animation runs. The variable-form reward lives here: same beat, three flavors. Animation uses the existing `400ms` odds-tick tokens in DESIGN.md.

The "Sharp move" pill reuses or extends `SharpMoney.jsx`.

### 5.3 Beat 3 — Social ticker (probabilistic, ~30% of predictions)

A second card slides in below Beat 2 only when one of the following conditions is true at predict time. Conditions are checked in priority order; first match wins. If none match, Beat 3 is silently skipped and the sheet ends after Beat 2.

| Condition | Eyal reward flavor | Example copy |
|---|---|---|
| User is the only holder on their side of the market | self | `You're alone on this.` |
| A user this user has predicted with previously (same market, same side, within 7d) just took the opposite side in the previous 60min | tribe | `{firstName} called the opposite an hour ago.` |
| Prediction crosses a round-number volume milestone for the market (100, 250, 500, 1000, 2500, 5000…) | hunt | `You're prediction #1,000 on this market.` |
| User's all-time accuracy in this market's category is in the top 10% (minimum 5 resolved calls in that category required) | self | `You're a top 10% caller on football. We'll see.` |

**Why the unpredictability is the engine.** Most pulls of the lever produce no Beat 3. Occasionally one lands. The *occasionality* is what builds the habit — same pattern as Slack/Twitter notifications.

**Why these four specifically.**
- All three Eyal reward flavors represented (self, tribe, hunt).
- All four are derivable from existing tables in a single query each (positions, markets, users). No new social-graph infrastructure required.
- The 30% target rate is approximate — whatever falls naturally out of these conditions on real data. Instrumented but not tuned in this ship.

### 5.4 Dismissal

- Auto-dismiss after 4 seconds of inactivity, OR tap outside the sheet.
- A small inline "View market" link returns the user to the (updated) market detail page in normal mode.
- The sheet does not navigate. The user is still on the same market page underneath.

### 5.5 Anti-patterns explicitly excluded

- No celebration sounds.
- No "you might also like" market cross-promotion inside the reveal.
- No streak counter, XP shower, or level-up animation. Those reward showing up, not being right.
- No modal dialog before placement. The reveal *is* the confirmation.

### 5.6 Component changes

- The existing `PredictionConfirmation.jsx` is restructured into the three-beat sheet, or its responsibilities are migrated into a new `PredictionReveal.jsx` if the existing component is too entangled. The implementation plan decides which — this spec only constrains behavior.
- The odds-shift animation reuses existing odds-tick animation tokens in DESIGN.md.
- The "Sharp move" pill reuses or extends `SharpMoney.jsx`.

## 6. Investment — accuracy as identity, open positions as triggers

Two complementary mechanisms: the visible identity surface (Part A) and the invisible trigger system (Part B). Together they ensure each prediction stores value the user does not want to lose and loads the next trigger.

### 6.1 Part A — Accuracy as the identity surface

The `Profile.jsx` header is reworked so that accuracy is the page's center of gravity.

**Profile header, top to bottom:**

1. **Display name + university tag.** Existing, label-sized.
2. **All-time accuracy as the hero number** in Fraunces hero scale (80px). Format: `73%`. Below in mono-label: `RESOLVED CALLS · {n}`. This is the first thing visible to strangers landing from a share.
3. **Last-30-days accuracy.** One line in mono-data: `30D · 68% · {n} calls`. Ink-muted.
4. **Per-category strip.** Horizontally scrollable on mobile, inline on desktop. Chips: category name in label, accuracy % in mono. Hidden for any category with <5 resolved calls.
5. **Rank line.** `Rank #47 of {n} · top 8% on accuracy`. Percentile is the durable claim.
6. **Open positions count + nearest resolution time.** `8 open calls · next resolves in 6h`. Small but consequential — the trigger preview, visible on the user's own profile.

**Demoted or removed:**

- **Total points / lifetime volume:** moved off the hero to a small "wallet" section further down. Volume rewards the wrong behavior.
- **Win/loss streak counts:** removed from the profile entirely. They remain in the gamification module for internal use but are not surfaced as identity.
- **WhatsApp community link** (added in commit `d5800a7`): kept, moved below the fold to the secondary area.

**Public vs. own profile:**

- Strangers viewing a profile see: name + tag, hero accuracy, 30-day, per-category strip, rank line, open positions count.
- The owner sees the above plus wallet, settings, and the secondary sections.
- Profiles remain public read-only to non-owners. Privacy controls deferred.

**Share card:**

- `ProfileShareModal` and `shareImage.js` continue to capture a DOM node as image.
- The captured node is now a tight crop of the new header: hero accuracy, name, rank line, category strip.
- Default share text: `{firstName} is {accuracy}% accurate on IroyinMarket. {rank_line}.`
- No CTA on the artifact itself. Editorial quote card, not a referral ad.

### 6.2 Accuracy calculation rules

- **Accuracy** = (correct resolved calls) / (total resolved calls).
- A *call* = one user's net position on one market at resolution. Multiple predictions on the same outcome of the same market count as **one call**; judged by final net position.
- A user net-flat at resolution (bought both sides, no net position) — that market is excluded from both numerator and denominator. Pure arbitrage does not get accuracy credit.
- Markets resolved as `void` or `canceled` are excluded.
- **Per-category accuracy** uses the same logic, filtered by `market_category` (already on the positions schema per commit `cd29889`).
- **Display threshold:** the headline number renders only when the user has ≥3 resolved calls. Below that, the hero shows `New caller` in Fraunces. The 30-day row hides until ≥3 resolved calls in the last 30 days. Per-category strip chips hide until ≥5 resolved calls in that category. This prevents 100%-after-one-lucky-call vanity stats.

### 6.3 Part B — Open positions as future triggers

Every open position becomes a scheduled future event. When a market hits a defined milestone, a trigger fires.

**Trigger conditions for this ship — only these four:**

| Condition | Fires when | Surfaces in |
|---|---|---|
| **Resolution today** | Market scheduled to resolve in next 24h; user has open position | Lede priority 2 in next daily WhatsApp |
| **Resolved while away** | Market just resolved; user has position on it; user has not opened the app within the 12h preceding resolution | One-off WhatsApp message outside the daily window, max one per day, suppressed if a daily was sent within the previous 6h |
| **Sharp move on your position** | Odds on a market the user holds moved >10pp in the previous 1h | Strip at top of `/markets` next time the user opens the app. No push or WhatsApp send for this in this ship. |
| **Position is decisive** | User's position is the only one on its side OR one of <5 holders | Eligible to be Beat 3 of the reveal — evaluated synchronously at predict time (§5.3). Not persisted in `position_triggers`. |

The first two load the WhatsApp cue. The third is a passive in-app reward. The fourth piggybacks on the reveal. The "decisive position" condition is intentionally absent from the `position_triggers` table in §6.4 because it is evaluated inline at predict time and does not need queuing — its only consumer is the reveal sheet.

**Trigger throttling:**

- A user receives **at most one WhatsApp message per day total.** If a "resolved while away" trigger fires and a daily was already scheduled within 6h, the resolution is folded into the daily lede (e.g., `Your call on X just resolved. Win. 2 of your calls resolve today.`). No second message.
- "Resolved while away" only sends if the user has not opened the app in the previous 12h. Otherwise the in-app activity feed will already surface it.
- No daily portfolio digest. The four conditions above are event-driven; bundling defeats their freshness.

### 6.4 Persistence

New table `position_triggers`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `position_id` | uuid FK → positions | |
| `condition` | enum | `resolution_today`, `resolved_away`, `sharp_move` |
| `eligible_at` | timestamptz | When the trigger first became eligible |
| `fired_at` | timestamptz nullable | Set when a surface delivered it |
| `surfaced_via` | enum nullable | `wa_daily`, `wa_oneoff`, `in_app_strip` |
| `created_at`, `updated_at` | timestamptz | |

Evaluation runs on the existing scheduler (added for simulation), every 10 minutes. The job evaluates positions for each condition, writes eligible rows, and is idempotent (a position+condition pair only generates one row until that row is fired and cleared).

The WhatsApp send job and the markets-page API read from this table.

## 7. Data model changes

### 7.1 `users` table (existing — naming kept as `students` in code)

Add:

| Column | Type | Notes |
|---|---|---|
| `wa_anchor_time` | time, nullable | Per-user morning anchor (e.g., `07:48:00`). Null until user opts into daily sends. |
| `wa_daily_enabled` | boolean, default false | True after the user sends first message to bot AND completes web opt-in. |
| `wa_paused_until` | timestamptz, nullable | Set by PAUSE reply or by 2-strike failure rule. |
| `wa_failure_count` | integer, default 0 | Reset to 0 on any successful send. |
| `last_app_open_at` | timestamptz, nullable | Updated on any authenticated web request. Used by the 4-hour skip rule and the 12-hour resolved-away rule. |

### 7.2 `whatsapp_daily_queue` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `scheduled_for` | timestamptz | Computed daily as `anchor_time ± jitter` |
| `lede_type` | enum nullable | `rank`, `resolution`, `social`, `curiosity` |
| `lede_payload` | jsonb nullable | Whatever data the lede needs to render (market_id, rank_delta, etc.) |
| `markets` | jsonb | Array of 2–3 `{market_id, label, odds, resolves_in_minutes}` |
| `body_text` | text nullable | Rendered final message body. Populated at send time, not earlier, so last-minute facts are fresh. |
| `status` | enum | `pending`, `sent`, `failed`, `skipped` |
| `attempts` | integer | |
| `last_error` | text nullable | |
| `created_at`, `sent_at` | timestamptz | |

### 7.3 `positions` table (existing)

Add:

| Column | Type | Notes |
|---|---|---|
| `source_ref` | text nullable | Persists the `ref` query param from §3.5 (e.g., `wa_daily:rank`, `direct`, `share`, etc.). Used for attribution. |

### 7.4 `position_triggers` (new)

See §6.4.

## 8. Telemetry

Minimum instrumentation for the ship:

| Event | When | Properties |
|---|---|---|
| `wa_daily_sent` | After successful Baileys send | `user_id`, `lede_type`, `markets_count`, `latency_from_scheduled` |
| `wa_daily_failed` | On Baileys send failure | `user_id`, `error_class` |
| `wa_daily_skipped` | When skip rule applies | `user_id`, `reason` (`recent_active`, `paused`, `no_lede`) |
| `deep_link_landed` | On any page hit with `?ref=wa_daily` | `user_id`, `lede`, `market_id`, `latency_from_send` |
| `prediction_placed` | Existing event, extended | Add `source_ref` property |
| `reveal_beat3_shown` | When Beat 3 renders | `user_id`, `condition` |
| `position_trigger_eligible` | When a row is written to `position_triggers` | `user_id`, `condition`, `position_id` |
| `position_trigger_surfaced` | When `fired_at` is set | `user_id`, `condition`, `surfaced_via` |
| `profile_share_captured` | On share-image generation | `user_id` (viewer), `target_user_id` |

The four core funnels these support: send → land → predict, lede type → predict conversion, Beat 3 incidence rate, trigger eligibility → surfacing.

## 9. Success criteria

After 30 days post-launch, for users who were enrolled in the daily WhatsApp send for the full period:

1. **Median daily app-open rate** (defined as opening the web app at least once on a calendar day) of enrolled users exceeds the same metric for a baseline comparison cohort of users matched on signup date and pre-launch activity by at least 25% relative.
2. **At least 40%** of daily WhatsApp messages result in a deep-link landing within 6 hours of send (attributed via `?ref=wa_daily`).
3. **At least 50%** of deep-link landings result in a prediction within the same session.
4. **Median time from deep-link land to prediction** under 15 seconds (target was <10s; <15s is the launch bar).
5. **Beat 3 incidence rate** between 20% and 40% of predictions (sanity check that the social ticker is not over- or under-firing).
6. **Zero bans of the bot's WhatsApp account** during the period (the operational hard floor — if the bot is banned, the cue channel is destroyed).

Success criteria are deliberately retention-focused, not revenue or volume — those are downstream of habit and would conflate with market-quality effects.

## 10. Out-of-scope for this ship (explicit list)

- Market groups (per-market chat threads with 24h read-only delay). Will be a follow-up spec.
- Follow / followers graph.
- Web push notifications for in-app reactive triggers.
- Accuracy-based titles rework in the gamification module.
- Backend module rename (`students` → `users` or `predictors`).
- Multi-account Baileys sending pool.
- Privacy controls on the public profile.
- A/B testing framework for ledes.
- SMS fallback layer for users with stale WhatsApp.

## 11. Risk register

| Risk | Mitigation |
|---|---|
| Baileys account banned mid-launch | Pacing, jitter, opt-in-before-eligible, health monitor, drop-not-backfill on reconnect, single-account discipline. If banned, daily sends stop; web app and reactive in-app triggers continue functioning. |
| Cue feels spammy, users mute | One message per day max, 4h skip rule, PAUSE reply, STOP reply, no-lede-then-skip rule. |
| Default stake auto-detonates a careless user's balance | Floor/ceiling caps, max 10% of balance per one-tap predict, ochre "max" pill when capped. |
| Optimistic UI shows success when server rejects | Inline rollback inside the reveal sheet with specific error; no silent state divergence. |
| Accuracy metric gamed by single-call vanity | 3-call minimum to show headline, 5-call minimum per category strip chip. |
| Beat 3 social ticker condition queries are slow | All four conditions designed to be derivable from existing indexes (positions by market_id, by user_id; resolved markets by category). If queries exceed 50ms p95 on production data, the condition is skipped for that prediction — Beat 3 always degrades to absence, never to error. |
| Position triggers job overlaps with simulation scheduler load | Triggers job is throttled and idempotent; can run every 10 minutes instead of every 5 if scheduler contention shows up. |
