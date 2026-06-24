# AI Market Creator — Design Spec

**Date:** 2026-06-24
**Status:** Draft, awaiting review
**Scope:** Replace the `AIMarketCreatorPanel` placeholder shipped in Spec 1 (admin control center) with a functional AI-assisted market drafting flow. Admin types a prompt OR taps a trending headline; Groq drafts a complete market (title, outcomes, category, close date, description); admin reviews/edits inline; clicks Publish. Markets become live immediately.

This is Spec 2 of the originally-paired plan from the brainstorm. Spec 1 (control center page) shipped to main as commit `6c11ea3` on 2026-06-23.

---

## 1. Product thesis

Admin currently creates markets manually via `POST /multi-markets/admin/create`, typing every field. For market types that lend themselves to AI assistance (sports matches, BBNaija evictions, hackathon winners, campus events with known close times), this is repetitive. The control center now exposes operational queues to the admin — Spec 2 extends that by giving the admin a single textbox that turns a prompt into a complete market draft they can review in ~30 seconds.

The brainstorm's intent was an admin-prompted flow as the primary path (the admin always knows what they want to predict) with a trending-headlines panel as a secondary discovery aid. Trending suggestions are surfaced from existing RSS infrastructure plus three new sources (Goal Nigeria, Premium Times, Pulse Nigeria), processed through Groq to filter for headlines that resolve to a verifiable outcome.

## 2. User flow and panel anatomy

The `AIMarketCreatorPanel` becomes a 3-state interactive panel inside the existing control center's Today's Work zone. State transitions are local React state — no routing.

### 2.1 State A — Idle (default on mount)

- Header: `Sparkles` icon + "Create market with AI".
- Textarea: placeholder *"What's trending? e.g., UNILAG vs OAU Saturday, BBNaija eviction tonight"*. `maxLength={500}`.
- "Draft with AI" primary button.
- Below the textarea, a collapsed "Trending now" section with a *"Show suggestions"* button. Default collapsed because we run the LLM only on demand and don't want to surprise admins with a delayed first paint.

When admin expands the trending section, the panel auto-fires a `refresh-trends` request. Results render as a tappable list of 3–5 cards (one per suggestion). Each card shows: rewritten prediction-question title, source name, "Use this" button. Tapping a card seeds the textarea with the suggestion's title and triggers a `/draft` request immediately.

A `Refresh trends` button next to the section header re-fetches. Server-side throttle (60s cooldown) is invisible to the admin — cached results are returned within that window with a small "Last refreshed Xs ago" timestamp.

### 2.2 State B — Generating

- Textarea + button replaced with an inline spinner: *"Drafting market..."*.
- Skeleton placeholders for title/outcomes/category appear below.
- Trends list stays visible but disabled.
- Cancel button lets the admin abort the request via `AbortController`. Cancellation returns the panel to State A with the textarea contents preserved.

### 2.3 State C — Preview (after successful generation)

Editable form fields, all pre-filled by AI:

- **Title** — single-line `Input`. Range 10–200 chars enforced client-side.
- **Outcomes** — 2 to 4 dynamic rows. Each row is an `Input` for the outcome label (1–60 chars). + Add outcome / − Remove outcome buttons. Minimum 2 enforced; maximum 4 enforced.
- **Category** — `Select` of the 8 existing categories: `scholarships, entertainment, tech, sports, campus_news, career, health, academic`.
- **Closes at** — `Input type="datetime-local"` with the AI's suggestion pre-filled in the admin's local timezone. On publish, the value is sent to the server as an ISO-8601 UTC string. Server rejects past dates and dates >90 days out.
- **Description** — `Textarea`, 2–3 lines tall, with AI's draft. Optional, ≤500 chars.

Two buttons: **Publish** (primary), **Discard**. Publish calls `POST /admin/ai-market/publish` with the edited fields. Discard clears state and returns to State A.

On successful publish: card briefly shows "Market published ✓" then returns to State A with the form cleared. On publish failure: inline error inside the card; the draft state is preserved so admin can retry without re-prompting.

### 2.4 Telemetry events

Six events, fired via the existing `track()` helper from `@/lib/telemetry`:

| Event | When | Properties |
|---|---|---|
| `cc_ai_draft_requested` | Admin clicked "Draft with AI" | `prompt_length`, `seeded_from_trend` |
| `cc_ai_draft_received` | `/draft` returned successfully | `latency_ms`, `outcome_count`, `category` |
| `cc_ai_draft_published` | Successful publish | `market_id`, `category`, `outcome_count`, `fields_edited` (array of field names) |
| `cc_ai_draft_discarded` | Admin clicked Discard in State C | `time_in_preview_seconds` |
| `cc_ai_trend_refresh` | `/trends` returned | `result_count`, `partial_failure`, `latency_ms`, `cached` |
| `cc_ai_trend_tapped` | Admin tapped a trend card | `trend_index`, `category` |

No PII captured. Prompt content is not logged — only its length.

## 3. Backend — endpoints, prompts, RSS sources

### 3.1 New endpoints

All under `/api/admin/ai-market/`. All require `authenticate` + `requireRole('super_admin', 'moderator')`.

| Endpoint | Body | Returns | Notes |
|---|---|---|---|
| `POST /admin/ai-market/draft` | `{ prompt: string }` | `{ title, outcomes: string[], category, closesAt, description, model, latencyMs }` | Server-side rate limit: 10 requests/min per admin. |
| `POST /admin/ai-market/trends` | (none) | `{ trends: [{ title, source, url, category }], fetchedAt, latencyMs, partialFailure, cached }` | Server-side cooldown: 60s per admin (returns cached result with `cached: true` flag if within window). |
| `POST /admin/ai-market/publish` | `{ title, outcomes, category, closesAt, description, liquidityB? }` | `{ marketId, title, status: 'open' }` | Thin wrapper over the existing `multiMarkets.createMarket` + `addOutcome` + `seedMarketLiquidity` flow. |

The publish endpoint is a deliberate small wrapper over the existing `POST /multi-markets/admin/create`. We add a new endpoint rather than reuse the existing one for two reasons: (a) future telemetry separation (markets created via AI flow vs. manually) is cleaner; (b) we add description-column persistence here without changing the existing route. Internal logic delegates to the same service functions, so no duplication of market-creation logic.

### 3.2 Groq prompt

Model: `llama-3.1-8b-instant` (matching the existing `content.ai.js` pattern). Temperature: 0.3 (more deterministic than the content generator's 0.7, because we want predictable structure).

System prompt:

```
You are a prediction-market designer for IroyinMarket, a Nigerian campus prediction market.
You draft markets that resolve to a single, verifiable outcome within 90 days.

Rules:
- Title is a question with a single yes/no or A/B/C/D answer. Never multiple questions.
- 2 to 4 mutually-exclusive outcomes. They must collectively cover all reasonable possibilities.
- closesAt is the moment after which no more predictions can be made — i.e., when the event happens.
- category is one of: scholarships, entertainment, tech, sports, campus_news, career, health, academic.
- description is 1-2 sentences explaining what's being predicted and how it resolves.
- Reject prompts that can't resolve verifiably (e.g., "Will I be happy?", "Who is the best player?").

Output strict JSON only. No prose. Schema:
{"title": string, "outcomes": [string, ...], "category": string,
 "closesAt": ISO-8601 timestamp, "description": string}
```

User prompt for `/draft`: `Prompt: ${admin_prompt}\nCurrent date: ${ISO_today}`.

User prompt for `/trends`: `Here are today's Nigerian headlines:\n${headlines_joined}\n\nReturn 5 of the most market-worthy headlines as a JSON array of objects: {"title": string (rewritten as a prediction market question), "source": string, "url": string, "category": string}. The "category" field MUST be one of: scholarships, entertainment, tech, sports, campus_news, career, health, academic. If a headline is politics, map it to "campus_news". Skip headlines that can't resolve verifiably.`

Both wrap responses in `try { JSON.parse } catch` with a 502 if the model returns malformed JSON.

### 3.3 RSS source additions

Three new entries added to `iroyinayo/src/modules/content/sources.js` `SOURCES` array:

```javascript
{ name: 'Goal Nigeria', category: 'sports', type: 'rss', url: 'https://www.goal.com/feeds/en/news?fmt=rss&ICID=AR' },
{ name: 'Premium Times Politics', category: 'politics', type: 'rss', url: 'https://www.premiumtimesng.com/category/news/top-news/feed' },
{ name: 'Pulse Nigeria Entertainment', category: 'entertainment', type: 'rss', url: 'https://www.pulse.ng/entertainment/rss' },
```

The `politics` category is new for sources but does not appear in market categories — the LLM maps politics headlines to the best existing market category (most likely `campus_news` or `academic`), or skips them entirely if no good fit.

**Failure mode:** RSS feeds can break. The existing `fetchRSS` catches per-source errors and logs them. `/trends` returns `partialFailure: true` if any source failed but at least one succeeded. The admin sees fewer suggestions but no error.

### 3.4 Schema change

One migration: `iroyinayo/migrations/032_add_description_to_multi_markets.js` adds:

```javascript
table.text('description').nullable();
```

Reversible. The existing market-creation flow ignores the column; the new AI publish endpoint passes it through. UI surfacing of `description` on the consumer app is out of scope for this spec.

### 3.5 Costs and rate limits

Groq Llama 3.1 8B Instant on free tier: 30 RPM, 6000 TPM. Our limits keep us well under this:
- `/draft`: 10 req/min/admin = comfortable under 30 RPM combined across admins.
- `/trends`: 60s cooldown = max 1/min/admin.

If usage ever exceeds the free tier and Groq's paid tier is triggered, a single 8B model call costs ~$0.0001. At the admin volumes we expect (10–50 markets/week), monthly cost stays under $1 even on paid tier. The success-criteria budget guardrail (§8) is set at $5/month as a safety margin.

No new dependency. Uses existing `groq-sdk` already in `iroyinayo/package.json`.

## 4. Data flow

### 4.1 Draft flow

The draft flow has two entry points: admin types a prompt and clicks "Draft with AI", OR admin taps a trend card (which seeds the textarea with the suggestion's title and fires `/draft` immediately). Both paths converge at the same `/draft` POST; the only difference is the `seeded_from_trend` telemetry property.

```
Admin types prompt OR taps trend card → POST /admin/ai-market/draft { prompt }
   ↓
[Rate limit check: ≤10/min/admin] → 429 if exceeded
   ↓
[Validate prompt: 5-500 chars, no URLs]
   ↓
[Call Groq with system + user prompts] → 502 if Groq down
   ↓
[Parse JSON response] → 502 if malformed
   ↓
[Validate parsed draft against rules — §4.3]
   ↓
[Emit telemetry: cc_ai_draft_received]
   ↓
Return { title, outcomes, category, closesAt, description, model, latencyMs }
   ↓ Panel sets State C: preview
   ↓ Admin edits any field
   ↓ Admin clicks "Publish"
   ↓ POST /admin/ai-market/publish { title, outcomes, category, closesAt, description }
   ↓
[Re-validate inputs server-side — §4.3]
   ↓
[Call multiMarkets.createMarket(title, null, null)]
[Update multi_markets SET category = ?, description = ? WHERE id = ?]
[Call multiMarkets.addOutcome(marketId, label) for each outcome]
[Call multiMarkets.seedMarketLiquidity(marketId)]
   ↓
[Emit telemetry: cc_ai_draft_published]
   ↓
Return { marketId, title, status: 'open' }
   ↓ Panel briefly shows "Market published ✓" then returns to State A
```

The published market is immediately open and visible on the consumer app's markets list. It does not go through the user-created `pending` flow because the admin is the creator — same as the existing `POST /multi-markets/admin/create` behavior.

### 4.2 Trend flow

```
Admin clicks "Refresh trends"
   ↓ POST /admin/ai-market/trends
   ↓
[Cooldown check: was this admin's last /trends call <60s ago?]
   ├── yes → return cached result from that earlier call (in-memory per-admin cache, with cached: true flag)
   └── no  → continue
   ↓
[fetchAllNews() → existing function in content/sources.js]
   ↓ returns headlines from all 11 RSS sources (existing 8 + 3 new)
   ↓ some sources may fail — collect partialFailure flag
   ↓
[Trim to top 30 headlines by recency (last 24h)]
   ↓
[Call Groq with trend system prompt] → 502 if Groq down
   ↓
[Parse JSON array of 5 suggestions]
   ↓
[Validate each: title 10-200 chars, valid category, valid URL]
   ↓
[Cache result in-memory per admin for 60s]
   ↓
[Emit telemetry: cc_ai_trend_refresh { result_count, partial_failure }]
   ↓
Return { trends, fetchedAt, latencyMs, partialFailure, cached: false }
```

### 4.3 Validation rules

Server-side, enforced on both `/draft` (validates LLM output before returning) and `/publish` (validates admin's possibly-edited submission). Validation lives in a single helper `validateDraft(draft)` reused by both paths.

| Field | Rule | Error if violated |
|---|---|---|
| `title` | 10–200 chars, non-empty trimmed | `400 title length must be 10-200 chars` |
| `outcomes` | Array of 2–4 strings, each 1–60 chars, all unique after trim | `400 outcomes must be 2-4 unique strings of 1-60 chars` |
| `category` | One of the 8 valid categories | `400 invalid category` |
| `closesAt` | Valid ISO-8601, in the future, ≤90 days from now | `400 closesAt must be a future date within 90 days` |
| `description` | Optional, ≤500 chars | `400 description too long` |
| `prompt` (draft only) | 5–500 chars | `400 prompt must be 5-500 chars` |

If LLM output fails validation on `/draft`, return 502 with `error: 'ai_returned_invalid_draft'` and the admin sees a "Try a different prompt" message — the LLM is the source of failure, not the admin's input.

### 4.4 Edge cases

- **Admin pastes an existing market title.** No dedupe. Two markets with the same title can exist. Future: title-similarity check as a follow-up.
- **AI suggests outcomes that semantically overlap.** The unique-after-trim check catches exact dupes only. Admin edits the form.
- **Closes-at in the past after a long edit session.** Server rejects with 400 on publish. Client also displays a warning when `closesAt < now()`.
- **Admin's network drops mid-publish.** The publish endpoint is not idempotent. Retrying creates a duplicate. Accepted risk for v1. Admin deletes one via the existing Markets page.
- **Trend cache contains stale entries when admin returns the next day.** In-memory cache is per-process; server restart clears it. The 60s TTL handles freshness during a run.
- **Groq returns valid JSON but bogus category.** Validation rejects with 502 `ai_returned_invalid_draft`. System prompt explicitly lists allowed categories.

## 5. File structure

### 5.1 New backend files

```
iroyinayo/
├── migrations/
│   └── 032_add_description_to_multi_markets.js
├── src/modules/admin/aiMarket/
│   ├── aiMarket.routes.js
│   ├── aiMarket.service.js
│   ├── prompts.js
│   ├── groqClient.js
│   ├── validation.js
│   ├── trendCache.js
│   └── rateLimit.js
└── tests/admin/aiMarket/
    ├── prompts.test.js
    ├── validation.test.js
    ├── trendCache.test.js
    ├── aiMarket.service.test.js
    └── aiMarket.routes.test.js
```

A sub-directory `admin/aiMarket/` instead of flat under `admin/` because six files belong to one feature. Prevents the `admin/` directory from becoming a junk drawer (it already has 8+ files from the control center work).

### 5.2 New frontend files

```
iroyinayo-admin/
└── src/components/control-center/ai-market-creator/
    ├── AIMarketCreatorPanel.jsx     # replaces existing placeholder
    ├── PromptInput.jsx
    ├── DraftPreview.jsx
    ├── OutcomeInputs.jsx
    ├── TrendsSection.jsx
    └── useDraftRequest.js
```

The existing 17-line placeholder at `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx` is DELETED and replaced by a new file at the sub-directory path. Same component name, new location.

### 5.3 Existing files modified

| Path | Change |
|---|---|
| `iroyinayo/src/modules/content/sources.js` | Add 3 new RSS sources to the existing `SOURCES` array. |
| `iroyinayo/src/app.js` | Register `aiMarketRoutes` under `/api/admin`. |
| `iroyinayo-admin/src/lib/api.js` | Extend the `cc` object with `getAIMarketDraft(prompt)`, `getAIMarketTrends()`, `publishAIMarket(payload)`. |
| `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` | Update import path from `./AIMarketCreatorPanel` to `./ai-market-creator/AIMarketCreatorPanel`. |
| `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx` | DELETED. |

### 5.4 Architectural rationale

- **`aiMarket.service.js` is the orchestrator.** It calls `validation.js`, `prompts.js`, `groqClient.js`, and `trendCache.js`. Routes are thin: parse req → call service → respond. Matches the `controlCenter.routes.js` + `controlCenter.service.js` split shipped in Spec 1.
- **`prompts.js` is just strings + builders.** No logic. Trivially testable. Easy to iterate the LLM prompt without touching anything else.
- **`groqClient.js` is one ~40-line file.** Owns `new Groq(...)` instantiation, the JSON-mode call, error mapping (Groq 5xx → our 502). Single import for tests to mock.
- **`useDraftRequest.js` on the frontend** owns the state machine (`idle | drafting | preview | error`), the `AbortController`, and the publish callback. Panel components below it are presentational.
- **`OutcomeInputs.jsx`** is extracted from `DraftPreview` for the same reason `BotStatusPill` was extracted from `HealthStrip` in Spec 1: a small component with its own array-management logic.

## 6. Error handling

| Error condition | Server response | Client behavior |
|---|---|---|
| Admin not authenticated | 401 (global handler) | Cookie cleared, redirect to `/login` |
| Admin lacks `super_admin`/`moderator` role | 403 `forbidden` | Inline error: "You don't have permission to create markets" |
| `/draft` rate limit exceeded (>10/min) | 429 `rate_limit_exceeded` with `retryAfter` seconds | Inline error: "Slow down — try again in N seconds". Button re-enables after countdown. |
| `/trends` 60s cooldown active | 200 with cached result + `cached: true` flag (NOT 429) | Panel renders cached results normally. UI shows "Last refreshed Xs ago". |
| `GROQ_API_KEY` not configured | 500 `groq_not_configured` | Inline error: "AI service is not configured. Contact ops." |
| Groq API down or 5xx | 502 `groq_unavailable` | Inline error: "AI service temporarily down. Try again in a minute." |
| Groq returns malformed JSON | 502 `ai_returned_invalid_response` | Inline error: "AI returned an unexpected format. Try a different prompt." |
| Groq returns valid JSON but fails validation | 502 `ai_returned_invalid_draft` with `details` | Inline error: "AI suggested an invalid market. Try a different prompt." Server logs details for prompt tuning. |
| Prompt fails client-side bounds (5–500 chars) | n/a — caught client-side | Inline validation under textarea. |
| Admin submits edited publish payload that fails validation | 400 with specific field error | Inline error next to the offending field. |
| Network error mid-request | n/a — `fetch` throws | Inline error: "Network error — check your connection." |
| Admin clicks Cancel during /draft | AbortController fires | Request aborted. Panel returns to State A. No partial state. |
| `multiMarkets.createMarket` throws in `/publish` | 500 propagated | Inline error: "Failed to publish market. Try again." Draft preserved in State C for retry. |

Per-panel isolation matches the control center pattern. Errors render inside the panel card, never as toasts. Other panels continue working.

No retry-on-failure for Groq. Admin clicks again.

## 7. Telemetry

See §2.4. Six events via the existing `track()` helper. Properties capture latency, counts, and admin behavior (which fields they edit) — no PII, no prompt content.

`fields_edited` on `cc_ai_draft_published` is the key product-feedback signal: if admins rewrite the title 80% of the time, the prompt needs tuning.

## 8. Success criteria

After 30 days of admin use:

1. **Draft → publish conversion rate ≥ 50%.** Of `/draft` requests that succeed, at least half result in a published market.
2. **Median fields edited per publish ≤ 1.** AI gets it right most of the time.
3. **/draft p95 latency ≤ 4 seconds.** Includes Groq round-trip.
4. **Trend refresh tap rate ≤ 30% of all draft sessions.** Most drafts come from prompts; trends are a discovery aid.
5. **Zero markets created with `closesAt` in the past.** Validation guarantee.
6. **Groq cost ≤ $5/month at current admin volume.** Budget guardrail.

Observable through PostHog `cc_ai_*` events and Groq's billing dashboard.

## 9. Out of scope (explicit)

- **Scheduled trend cron.** On-demand only. No 4am sweep.
- **URL paste in the prompt textarea.** Free-text only. URL-paste-and-summarize is a future spec.
- **Editing markets after publish.** The new flow only creates. Editing flows through existing admin pages.
- **Bulk publish.** Each trend tap or prompt is a separate draft → preview → publish cycle.
- **Custom liquidity in the panel.** Liquidity stays auto-scaled by `getAutoLiquidityB()`. Admin can adjust later via existing markets page.
- **Sponsor data in AI drafts.** AI doesn't suggest sponsors. Manual via existing admin/create flow.
- **AI moderation layer.** Groq has its own safety; system prompt instructs the LLM to reject unverifiable predictions; admin is the last line of defense.
- **Multi-language prompts.** English only. AI handles Nigerian English / Pidgin organically.
- **Saving prompts as templates.** Admin retypes. Templates are a follow-up.
- **AI dedup ("we already have a market like this").** Future feature.
- **UI surfacing of `description` on the consumer app.** Schema-only addition. Consumer-app integration is a follow-up.

## 10. Risk register

| Risk | Mitigation |
|---|---|
| LLM hallucinates outcomes that don't cover the question space | System prompt requires mutually-exclusive, collectively-exhaustive outcomes. Validation enforces 2–4 outcome count. Admin reviews before publish. |
| Markets published with vague resolutions ("Will the economy improve?") | System prompt requires verifiable resolution. Admin reads title before clicking Publish. Vague markets that still get through are admin judgment calls. |
| Adversarial prompts trying to jailbreak Groq | Groq has its own safety. Worst case: malformed JSON (validator rejects) or offensive title (admin discards). No markets without admin click. |
| RSS sources break | Existing `fetchRSS` handles per-source errors. `/trends` returns `partialFailure: true`. Panel renders fewer suggestions; no error toast. |
| Groq pricing changes / model deprecated | Architecture isolates Groq behind `groqClient.js`. Swap providers by replacing one file. |
| Server restarts wipe in-memory trend cache | TTL is 60s. Restart clears cache; next `/trends` call fetches fresh. Acceptable tradeoff vs. adding a database table. |
| Admin abandons mid-draft, panel state lost on refresh | Accepted. Drafts are ephemeral by design. Whole flow is ~30 seconds end-to-end. |
| Publish endpoint not idempotent (duplicate market on retry) | Accepted for v1. Admin deletes duplicate via existing markets page. Idempotency key is a follow-up if it becomes a real problem. |
