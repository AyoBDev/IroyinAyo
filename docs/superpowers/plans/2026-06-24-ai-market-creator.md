# AI Market Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AIMarketCreatorPanel` placeholder shipped in Spec 1 with a functional 3-state panel where admins draft markets from a text prompt or trending headline, edit fields inline, and publish — all without leaving the control center.

**Architecture:** New backend module at `iroyinayo/src/modules/admin/aiMarket/` with 7 focused files (routes, service, prompts, groqClient, validation, trendCache, rateLimit). Three new endpoints (`/draft`, `/trends`, `/publish`) under `/api/admin/ai-market/`. One migration adding `multi_markets.description`. Three new RSS sources appended to existing `sources.js`. Frontend replaces the existing 17-line placeholder with 6 components under `control-center/ai-market-creator/`, owned by a `useDraftRequest` state-machine hook.

**Tech Stack:** Backend — Node.js + Express, Knex/PostgreSQL, Jest, `groq-sdk` (existing dependency), `rss-parser` (existing). Frontend — Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui (`Input`, `Textarea`, `Select`, `Button`, `Card` — all available), `posthog-js` (already wired in Spec 1).

## Global Constraints

- **Working directory:** `/Users/mac/Documents/claudeCode/new p/worktrees/ai-market-creator`. All `git` and shell commands run from there. Never modify the main checkout.
- **Branch:** `feat/ai-market-creator`. Branched from `main` at commit `6c11ea3` (the Spec 1 merge commit).
- **Spec is canonical.** Path: `docs/superpowers/specs/2026-06-24-ai-market-creator-design.md`. Numbers and thresholds in this plan defer to the spec.
- **Routes mount under `/api/admin`** following the existing pattern from `iroyinayo/src/app.js`. The new module mounts as `aiMarketRoutes` alongside `controlCenterRoutes`, `marketReportsRoutes`, etc.
- **Admin auth middleware:** `authenticate` from `iroyinayo/src/middleware/auth.js` (populates `req.admin`). `requireRole('super_admin', 'moderator')` from `iroyinayo/src/middleware/adminRole.js` gates ALL three new routes (every route in this feature is destructive — they trigger paid LLM calls or create markets).
- **Migration numbering:** continues from `031_add_weekly_winner_paid_metadata.js`. New migration is `032`.
- **Test runner (backend):** `cd iroyinayo && npm test -- <pattern>`. Tests use `crypto.randomUUID()` (NOT the `uuid` npm package — see existing `iroyinayo/tests/admin/marketReports.test.js` for the pattern).
- **Frontend tests:** no test runner is configured in `iroyinayo-admin/`. Verify by `cd iroyinayo-admin && npm run build`. Manual smoke against a running backend.
- **Groq model:** `llama-3.1-8b-instant` exactly (matches existing `iroyinayo/src/modules/content/content.ai.js`). Temperature `0.3`. Max tokens `1024`. Stream off.
- **Existing functions to consume:**
  - `iroyinayo/src/modules/content/sources.js` exports `SOURCES`, `fetchNewsForCategory`, `fetchAllNews`, `fetchRSS`, `fetchScrape`.
  - `iroyinayo/src/modules/markets/multiMarkets.service.js` exports `createMarket(title, liquidityB, sponsorData)`, `addOutcome(marketId, label)`, `seedMarketLiquidity(marketId)`, `getMarketWithOdds(marketId)`.
- **Categories (8 valid):** `scholarships, entertainment, tech, sports, campus_news, career, health, academic`. Hard-coded in the system prompt AND in validation.
- **Telemetry:** Use the existing `track()` helper from `iroyinayo-admin/src/lib/telemetry.js` (wired in Spec 1). Six new `cc_ai_*` events per spec §2.4.
- **No AI attribution in commit messages.** No `Co-Authored-By: Claude` trailers, no "Generated with Claude" mentions. Commit format: `<area>: <summary>` (e.g., `feat(ai-market): add draft endpoint`).

---

## File Structure

### New backend files

```
iroyinayo/
├── migrations/
│   └── 032_add_description_to_multi_markets.js
└── src/modules/admin/aiMarket/
    ├── aiMarket.routes.js          # 3 routes: /draft, /trends, /publish
    ├── aiMarket.service.js         # orchestrates validation + groq + market creation
    ├── prompts.js                  # SYSTEM_PROMPT + buildDraftPrompt + buildTrendPrompt
    ├── groqClient.js               # ~40-line wrapper, error mapping
    ├── validation.js               # validateDraft + validateTrendSuggestion
    ├── trendCache.js               # per-admin in-memory 60s cache
    └── rateLimit.js                # /draft 10/min/admin token-bucket
```

### New backend tests

```
iroyinayo/tests/admin/aiMarket/
├── prompts.test.js                 # builders produce expected strings
├── validation.test.js              # 7 rules × pass/fail cases
├── trendCache.test.js              # TTL, per-admin isolation, eviction
├── rateLimit.test.js               # token-bucket behavior
├── aiMarket.service.test.js        # service-level integration (mocked Groq, real DB)
└── aiMarket.routes.test.js         # supertest end-to-end (mocked Groq, real DB)
```

### New frontend files

```
iroyinayo-admin/src/components/control-center/ai-market-creator/
├── AIMarketCreatorPanel.jsx        # 3-state container, uses useDraftRequest
├── PromptInput.jsx                 # State A: textarea + Draft button
├── DraftPreview.jsx                # State C: editable form + Publish/Discard
├── OutcomeInputs.jsx               # add/remove outcome rows (used inside DraftPreview)
├── TrendsSection.jsx               # collapsible list of trend cards
└── useDraftRequest.js              # custom hook: AbortController + state machine
```

### Existing files modified

| Path | Change |
|---|---|
| `iroyinayo/src/modules/content/sources.js` | Append 3 new RSS sources to `SOURCES` array (Goal Nigeria, Premium Times Politics, Pulse Nigeria Entertainment). |
| `iroyinayo/src/app.js` | Register `aiMarketRoutes` under `/api/admin` near the other admin route mounts. |
| `iroyinayo-admin/src/lib/api.js` | Extend `cc` object with `getAIMarketDraft(prompt)`, `getAIMarketTrends()`, `publishAIMarket(payload)`. |
| `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` | Update import path from `./AIMarketCreatorPanel` to `./ai-market-creator/AIMarketCreatorPanel`. |
| `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx` | DELETE (replaced by sub-directory version). |

---

## Task ordering rationale

- **Task 1:** Migration 032 (schema first, so backend tests can use the new column).
- **Tasks 2–4:** Pure helpers (prompts, validation, trendCache, rateLimit) — no Groq, no DB, fast unit tests, build the lego pieces.
- **Task 5:** groqClient (thin wrapper, mocked in service/routes tests).
- **Task 6:** Three new RSS sources (small additive change to existing file).
- **Task 7:** aiMarket.service (orchestrator that wires the helpers + groqClient + existing market creation). Heavily tested with mocked Groq.
- **Task 8:** aiMarket.routes (thin HTTP layer) + mount in app.js. End-to-end supertest verifies auth, route shape, validation, error responses.
- **Tasks 9–11:** Frontend foundations — `cc` api helpers, `useDraftRequest` hook, then each panel sub-component.
- **Task 12:** AIMarketCreatorPanel container + wire into TodaysWorkZone, delete old placeholder.
- **Task 13:** Telemetry events.
- **Task 14:** Final smoke (backend tests pass, frontend builds, manual run).

---

## Task 1: Migration 032 — multi_markets.description column

**Files:**
- Create: `iroyinayo/migrations/032_add_description_to_multi_markets.js`

**Interfaces:**
- Consumes: existing `multi_markets` table.
- Produces: `multi_markets.description` (text nullable). Used by Task 7's `publish` service call and Task 8's `/publish` route.

- [ ] **Step 1: Write the migration file**

Create `iroyinayo/migrations/032_add_description_to_multi_markets.js`:

```javascript
exports.up = async function (knex) {
  await knex.schema.alterTable('multi_markets', (table) => {
    table.text('description').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('multi_markets', (table) => {
    table.dropColumn('description');
  });
};
```

- [ ] **Step 2: Run migrations on dev + test DBs**

Run: `cd iroyinayo && npm run migrate && npm run migrate:test`
Expected: both succeed, listing `032_add_description_to_multi_markets.js`.

- [ ] **Step 3: Verify column exists**

Run: `PGPASSWORD= psql -U mac -d iroyinayo -h localhost -c "\d multi_markets" | grep description`
Expected: one row showing `description | text |   |   |` (nullable text column).

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/claudeCode/new\ p/worktrees/ai-market-creator
git add iroyinayo/migrations/032_add_description_to_multi_markets.js
git commit -m "feat(ai-market): add description column to multi_markets"
```

---

## Task 2: Prompts module

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/prompts.js`
- Create: `iroyinayo/tests/admin/aiMarket/prompts.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SYSTEM_PROMPT` (constant string)
  - `buildDraftPrompt(adminPrompt, isoToday)` → string
  - `buildTrendPrompt(headlinesJoined)` → string

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/admin/aiMarket/prompts.test.js`:

```javascript
const { SYSTEM_PROMPT, buildDraftPrompt, buildTrendPrompt } = require('../../../src/modules/admin/aiMarket/prompts');

describe('SYSTEM_PROMPT', () => {
  test('mentions all 8 valid categories', () => {
    for (const cat of ['scholarships', 'entertainment', 'tech', 'sports', 'campus_news', 'career', 'health', 'academic']) {
      expect(SYSTEM_PROMPT).toContain(cat);
    }
  });

  test('requires JSON-only output', () => {
    expect(SYSTEM_PROMPT).toMatch(/strict JSON only/i);
  });

  test('mentions 2-4 outcomes constraint', () => {
    expect(SYSTEM_PROMPT).toMatch(/2 to 4/);
  });

  test('mentions 90-day resolution window', () => {
    expect(SYSTEM_PROMPT).toMatch(/90 days/);
  });
});

describe('buildDraftPrompt', () => {
  test('includes admin prompt verbatim', () => {
    const out = buildDraftPrompt('UNILAG vs OAU Saturday', '2026-06-24');
    expect(out).toContain('UNILAG vs OAU Saturday');
  });

  test('includes ISO date', () => {
    const out = buildDraftPrompt('test', '2026-06-24');
    expect(out).toContain('2026-06-24');
  });
});

describe('buildTrendPrompt', () => {
  test('embeds the headlines block', () => {
    const headlines = '- Headline A\n- Headline B';
    const out = buildTrendPrompt(headlines);
    expect(out).toContain('Headline A');
    expect(out).toContain('Headline B');
  });

  test('instructs the LLM to map politics to campus_news', () => {
    const out = buildTrendPrompt('');
    expect(out).toMatch(/politics.*campus_news/i);
  });

  test('lists the 8 valid categories', () => {
    const out = buildTrendPrompt('');
    for (const cat of ['scholarships', 'entertainment', 'tech', 'sports', 'campus_news', 'career', 'health', 'academic']) {
      expect(out).toContain(cat);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `cd iroyinayo && npm test -- prompts.test.js`
Expected: FAIL with `Cannot find module '../../../src/modules/admin/aiMarket/prompts'`.

- [ ] **Step 3: Implement the module**

Create `iroyinayo/src/modules/admin/aiMarket/prompts.js`:

```javascript
const SYSTEM_PROMPT = `You are a prediction-market designer for IroyinMarket, a Nigerian campus prediction market.
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
 "closesAt": ISO-8601 timestamp, "description": string}`;

function buildDraftPrompt(adminPrompt, isoToday) {
  return `Prompt: ${adminPrompt}\nCurrent date: ${isoToday}`;
}

function buildTrendPrompt(headlinesJoined) {
  return `Here are today's Nigerian headlines:
${headlinesJoined}

Return 5 of the most market-worthy headlines as a JSON array of objects: {"title": string (rewritten as a prediction market question), "source": string, "url": string, "category": string}. The "category" field MUST be one of: scholarships, entertainment, tech, sports, campus_news, career, health, academic. If a headline is politics, map it to "campus_news". Skip headlines that can't resolve verifiably.`;
}

module.exports = { SYSTEM_PROMPT, buildDraftPrompt, buildTrendPrompt };
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `cd iroyinayo && npm test -- prompts.test.js`
Expected: 9/9 passing.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/prompts.js iroyinayo/tests/admin/aiMarket/prompts.test.js
git commit -m "feat(ai-market): prompt builders for draft and trends"
```

---

## Task 3: Validation module

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/validation.js`
- Create: `iroyinayo/tests/admin/aiMarket/validation.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `VALID_CATEGORIES` (array of 8 strings)
  - `MAX_CLOSE_DAYS` (90)
  - `validatePrompt(prompt)` → `{ ok: true } | { ok: false, error: string }`
  - `validateDraft(draft)` → `{ ok: true } | { ok: false, error: string, field?: string }`
  - `validateTrendSuggestion(suggestion)` → `{ ok: true } | { ok: false, error: string }`

- [ ] **Step 1: Write the failing tests**

Create `iroyinayo/tests/admin/aiMarket/validation.test.js`:

```javascript
const {
  VALID_CATEGORIES, MAX_CLOSE_DAYS,
  validatePrompt, validateDraft, validateTrendSuggestion,
} = require('../../../src/modules/admin/aiMarket/validation');

const validDraft = () => ({
  title: 'Will UNILAG beat OAU on Saturday?',
  outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
  category: 'sports',
  closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  description: 'Resolves to the winner of the UNILAG vs OAU football match.',
});

describe('validatePrompt', () => {
  test('accepts a 50-char prompt', () => {
    expect(validatePrompt('UNILAG vs OAU football match this Saturday at 4pm').ok).toBe(true);
  });
  test('rejects empty', () => {
    expect(validatePrompt('').ok).toBe(false);
  });
  test('rejects <5 chars', () => {
    expect(validatePrompt('abcd').ok).toBe(false);
  });
  test('rejects >500 chars', () => {
    expect(validatePrompt('a'.repeat(501)).ok).toBe(false);
  });
  test('rejects non-string', () => {
    expect(validatePrompt(null).ok).toBe(false);
    expect(validatePrompt(42).ok).toBe(false);
  });
});

describe('validateDraft', () => {
  test('accepts a valid draft', () => {
    expect(validateDraft(validDraft()).ok).toBe(true);
  });

  test('rejects title <10 chars', () => {
    const d = validDraft(); d.title = 'short';
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('title');
  });

  test('rejects title >200 chars', () => {
    const d = validDraft(); d.title = 'x'.repeat(201);
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects <2 outcomes', () => {
    const d = validDraft(); d.outcomes = ['only one'];
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('outcomes');
  });

  test('rejects >4 outcomes', () => {
    const d = validDraft(); d.outcomes = ['a', 'b', 'c', 'd', 'e'];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects duplicate outcomes (case-insensitive trim)', () => {
    const d = validDraft(); d.outcomes = ['UNILAG wins', '  unilag wins  '];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects outcome >60 chars', () => {
    const d = validDraft(); d.outcomes = ['a', 'b'.repeat(61)];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects empty outcome string', () => {
    const d = validDraft(); d.outcomes = ['valid', ''];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects invalid category', () => {
    const d = validDraft(); d.category = 'politics';
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('category');
  });

  test('rejects past closesAt', () => {
    const d = validDraft(); d.closesAt = new Date(Date.now() - 1000).toISOString();
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects closesAt >90 days out', () => {
    const d = validDraft(); d.closesAt = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString();
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects malformed closesAt', () => {
    const d = validDraft(); d.closesAt = 'not-a-date';
    expect(validateDraft(d).ok).toBe(false);
  });

  test('accepts missing description (optional)', () => {
    const d = validDraft(); delete d.description;
    expect(validateDraft(d).ok).toBe(true);
  });

  test('rejects description >500 chars', () => {
    const d = validDraft(); d.description = 'x'.repeat(501);
    expect(validateDraft(d).ok).toBe(false);
  });
});

describe('validateTrendSuggestion', () => {
  test('accepts a valid suggestion', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'Goal Nigeria',
      url: 'https://example.com/x',
      category: 'sports',
    }).ok).toBe(true);
  });

  test('rejects bad URL', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'x', url: 'not-a-url', category: 'sports',
    }).ok).toBe(false);
  });

  test('rejects invalid category', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'x', url: 'https://e.com', category: 'politics',
    }).ok).toBe(false);
  });
});

describe('VALID_CATEGORIES', () => {
  test('has all 8', () => {
    expect(VALID_CATEGORIES).toEqual([
      'scholarships', 'entertainment', 'tech', 'sports',
      'campus_news', 'career', 'health', 'academic',
    ]);
  });
});

describe('MAX_CLOSE_DAYS', () => {
  test('is 90', () => {
    expect(MAX_CLOSE_DAYS).toBe(90);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `cd iroyinayo && npm test -- validation.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validation**

Create `iroyinayo/src/modules/admin/aiMarket/validation.js`:

```javascript
const VALID_CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];
const MAX_CLOSE_DAYS = 90;
const PROMPT_MIN = 5;
const PROMPT_MAX = 500;
const TITLE_MIN = 10;
const TITLE_MAX = 200;
const OUTCOMES_MIN = 2;
const OUTCOMES_MAX = 4;
const OUTCOME_LABEL_MAX = 60;
const DESCRIPTION_MAX = 500;

function validatePrompt(prompt) {
  if (typeof prompt !== 'string') return { ok: false, error: 'prompt must be a string' };
  const trimmed = prompt.trim();
  if (trimmed.length < PROMPT_MIN) return { ok: false, error: `prompt must be at least ${PROMPT_MIN} chars` };
  if (trimmed.length > PROMPT_MAX) return { ok: false, error: `prompt must be at most ${PROMPT_MAX} chars` };
  return { ok: true };
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'draft must be an object' };

  // title
  if (typeof draft.title !== 'string') return { ok: false, error: 'title must be a string', field: 'title' };
  const title = draft.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return { ok: false, error: `title length must be ${TITLE_MIN}-${TITLE_MAX} chars`, field: 'title' };
  }

  // outcomes
  if (!Array.isArray(draft.outcomes)) return { ok: false, error: 'outcomes must be an array', field: 'outcomes' };
  if (draft.outcomes.length < OUTCOMES_MIN || draft.outcomes.length > OUTCOMES_MAX) {
    return { ok: false, error: `outcomes must have ${OUTCOMES_MIN}-${OUTCOMES_MAX} items`, field: 'outcomes' };
  }
  const trimmedOutcomes = [];
  for (const o of draft.outcomes) {
    if (typeof o !== 'string') return { ok: false, error: 'each outcome must be a string', field: 'outcomes' };
    const t = o.trim();
    if (t.length === 0) return { ok: false, error: 'outcome cannot be empty', field: 'outcomes' };
    if (t.length > OUTCOME_LABEL_MAX) return { ok: false, error: `outcome must be at most ${OUTCOME_LABEL_MAX} chars`, field: 'outcomes' };
    trimmedOutcomes.push(t.toLowerCase());
  }
  const unique = new Set(trimmedOutcomes);
  if (unique.size !== trimmedOutcomes.length) return { ok: false, error: 'outcomes must be unique', field: 'outcomes' };

  // category
  if (!VALID_CATEGORIES.includes(draft.category)) {
    return { ok: false, error: `category must be one of ${VALID_CATEGORIES.join(', ')}`, field: 'category' };
  }

  // closesAt
  if (typeof draft.closesAt !== 'string') return { ok: false, error: 'closesAt must be an ISO string', field: 'closesAt' };
  const closesAt = new Date(draft.closesAt);
  if (isNaN(closesAt.getTime())) return { ok: false, error: 'closesAt is not a valid date', field: 'closesAt' };
  const now = Date.now();
  if (closesAt.getTime() <= now) return { ok: false, error: 'closesAt must be in the future', field: 'closesAt' };
  if (closesAt.getTime() - now > MAX_CLOSE_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `closesAt must be within ${MAX_CLOSE_DAYS} days`, field: 'closesAt' };
  }

  // description (optional)
  if (draft.description !== undefined && draft.description !== null) {
    if (typeof draft.description !== 'string') return { ok: false, error: 'description must be a string', field: 'description' };
    if (draft.description.length > DESCRIPTION_MAX) {
      return { ok: false, error: `description must be at most ${DESCRIPTION_MAX} chars`, field: 'description' };
    }
  }

  return { ok: true };
}

function validateTrendSuggestion(s) {
  if (!s || typeof s !== 'object') return { ok: false, error: 'suggestion must be an object' };
  if (typeof s.title !== 'string' || s.title.trim().length < TITLE_MIN || s.title.length > TITLE_MAX) {
    return { ok: false, error: 'invalid title' };
  }
  if (typeof s.source !== 'string' || s.source.trim().length === 0) {
    return { ok: false, error: 'invalid source' };
  }
  try {
    const u = new URL(s.url);
    if (!u.protocol.startsWith('http')) return { ok: false, error: 'invalid url protocol' };
  } catch {
    return { ok: false, error: 'invalid url' };
  }
  if (!VALID_CATEGORIES.includes(s.category)) {
    return { ok: false, error: 'invalid category' };
  }
  return { ok: true };
}

module.exports = {
  VALID_CATEGORIES, MAX_CLOSE_DAYS,
  validatePrompt, validateDraft, validateTrendSuggestion,
};
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `cd iroyinayo && npm test -- validation.test.js`
Expected: 22/22 passing.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/validation.js iroyinayo/tests/admin/aiMarket/validation.test.js
git commit -m "feat(ai-market): validation for prompts, drafts, and trend suggestions"
```

---

## Task 4: TrendCache + RateLimit

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/trendCache.js`
- Create: `iroyinayo/src/modules/admin/aiMarket/rateLimit.js`
- Create: `iroyinayo/tests/admin/aiMarket/trendCache.test.js`
- Create: `iroyinayo/tests/admin/aiMarket/rateLimit.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `trendCache.get(adminId)` → `cachedResult | null`
  - `trendCache.set(adminId, result)` → void
  - `trendCache.TTL_MS` (60_000)
  - `rateLimit.consume(adminId)` → `{ ok: true } | { ok: false, retryAfterSeconds: number }`
  - `rateLimit.RATE_PER_MIN` (10)

- [ ] **Step 1: Write failing trendCache tests**

Create `iroyinayo/tests/admin/aiMarket/trendCache.test.js`:

```javascript
const trendCache = require('../../../src/modules/admin/aiMarket/trendCache');

describe('trendCache', () => {
  beforeEach(() => {
    trendCache._reset(); // clear in-memory state between tests
  });

  test('returns null when nothing cached', () => {
    expect(trendCache.get('admin-a')).toBeNull();
  });

  test('returns cached value after set', () => {
    trendCache.set('admin-a', { trends: [{ title: 'x' }] });
    expect(trendCache.get('admin-a')).toEqual({ trends: [{ title: 'x' }] });
  });

  test('isolates per admin', () => {
    trendCache.set('admin-a', { trends: [{ title: 'a' }] });
    trendCache.set('admin-b', { trends: [{ title: 'b' }] });
    expect(trendCache.get('admin-a').trends[0].title).toBe('a');
    expect(trendCache.get('admin-b').trends[0].title).toBe('b');
  });

  test('expires after TTL', () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      trendCache.set('admin-a', { x: 1 });
      expect(trendCache.get('admin-a')).toEqual({ x: 1 });
      t += trendCache.TTL_MS + 1;
      expect(trendCache.get('admin-a')).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  test('TTL_MS is 60000', () => {
    expect(trendCache.TTL_MS).toBe(60_000);
  });
});
```

- [ ] **Step 2: Write failing rateLimit tests**

Create `iroyinayo/tests/admin/aiMarket/rateLimit.test.js`:

```javascript
const rateLimit = require('../../../src/modules/admin/aiMarket/rateLimit');

describe('rateLimit', () => {
  beforeEach(() => {
    rateLimit._reset();
  });

  test('allows up to RATE_PER_MIN calls', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) {
      expect(rateLimit.consume('admin-a').ok).toBe(true);
    }
  });

  test('blocks the (RATE_PER_MIN+1)th call', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
    const r = rateLimit.consume('admin-a');
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test('isolates per admin', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
    expect(rateLimit.consume('admin-b').ok).toBe(true);
  });

  test('refills after 60 seconds', () => {
    const realNow = Date.now;
    let t = 5_000_000;
    Date.now = () => t;
    try {
      for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
      expect(rateLimit.consume('admin-a').ok).toBe(false);
      t += 60_001;
      expect(rateLimit.consume('admin-a').ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  test('RATE_PER_MIN is 10', () => {
    expect(rateLimit.RATE_PER_MIN).toBe(10);
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `cd iroyinayo && npm test -- "trendCache.test.js|rateLimit.test.js"`
Expected: both fail with module-not-found.

- [ ] **Step 4: Implement trendCache**

Create `iroyinayo/src/modules/admin/aiMarket/trendCache.js`:

```javascript
const TTL_MS = 60_000;
const _cache = new Map(); // adminId → { value, expiresAt }

function get(adminId) {
  const entry = _cache.get(adminId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(adminId);
    return null;
  }
  return entry.value;
}

function set(adminId, value) {
  _cache.set(adminId, { value, expiresAt: Date.now() + TTL_MS });
}

function _reset() {
  _cache.clear();
}

module.exports = { TTL_MS, get, set, _reset };
```

- [ ] **Step 5: Implement rateLimit**

Create `iroyinayo/src/modules/admin/aiMarket/rateLimit.js`:

```javascript
const RATE_PER_MIN = 10;
const WINDOW_MS = 60_000;
const _buckets = new Map(); // adminId → array of timestamps within the window

function consume(adminId) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = (_buckets.get(adminId) || []).filter((ts) => ts > cutoff);
  if (existing.length >= RATE_PER_MIN) {
    const oldestInWindow = existing[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    _buckets.set(adminId, existing);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }
  existing.push(now);
  _buckets.set(adminId, existing);
  return { ok: true };
}

function _reset() {
  _buckets.clear();
}

module.exports = { RATE_PER_MIN, consume, _reset };
```

- [ ] **Step 6: Verify GREEN**

Run: `cd iroyinayo && npm test -- "trendCache.test.js|rateLimit.test.js"`
Expected: 11/11 passing across both files.

- [ ] **Step 7: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/trendCache.js iroyinayo/src/modules/admin/aiMarket/rateLimit.js iroyinayo/tests/admin/aiMarket/trendCache.test.js iroyinayo/tests/admin/aiMarket/rateLimit.test.js
git commit -m "feat(ai-market): trend cache and per-admin rate limiter"
```

---

## Task 5: GroqClient wrapper

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/groqClient.js`

**Interfaces:**
- Consumes: `process.env.GROQ_API_KEY`, `groq-sdk` (existing dependency).
- Produces:
  - `getClient()` → Groq client instance, throws `Error('GROQ_API_KEY is not configured')` if env unset.
  - `async callJSON({ systemPrompt, userPrompt, model, temperature, maxTokens })` → `{ parsed, model, latencyMs }`. Wraps a single Groq chat completion call configured for JSON output, with `try { JSON.parse } catch` returning a typed error.
  - On Groq 5xx or network error: throws `Error('groq_unavailable: ...')`.
  - On JSON parse failure: throws `Error('ai_returned_invalid_response: ...')`.

We don't write a dedicated test file for `groqClient.js` — it's mocked in higher-level tests (Task 7 and 8). Direct testing would require either real Groq calls (slow, costs money) or so much mocking it tests nothing useful.

- [ ] **Step 1: Implement groqClient**

Create `iroyinayo/src/modules/admin/aiMarket/groqClient.js`:

```javascript
const Groq = require('groq-sdk');

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY is not configured');
  }
  return new Groq({ apiKey: key });
}

async function callJSON({ systemPrompt, userPrompt, model = 'llama-3.1-8b-instant', temperature = 0.3, maxTokens = 1024 }) {
  const client = getClient();
  const startedAt = Date.now();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    throw new Error(`groq_unavailable: ${err.message}`);
  }

  const latencyMs = Date.now() - startedAt;
  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('ai_returned_invalid_response: empty completion');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`ai_returned_invalid_response: ${err.message}`);
  }

  return { parsed, model, latencyMs };
}

module.exports = { getClient, callJSON };
```

The `response_format: { type: 'json_object' }` flag is Groq's JSON-mode toggle and tightens the parse rate substantially. The existing `content.ai.js` does NOT use this flag; this is a deliberate improvement for our structured-output use case.

- [ ] **Step 2: Sanity-check**

Run: `cd iroyinayo && node -c src/modules/admin/aiMarket/groqClient.js && echo OK`
Expected: prints `OK` (clean parse).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/groqClient.js
git commit -m "feat(ai-market): Groq client wrapper with JSON mode + error mapping"
```

---

## Task 6: RSS source additions

**Files:**
- Modify: `iroyinayo/src/modules/content/sources.js` — append 3 new entries to the `SOURCES` array.

**Interfaces:**
- Consumes: existing `SOURCES` array.
- Produces: 3 additional RSS sources accessible via the existing `fetchAllNews()` function.

- [ ] **Step 1: Read the existing SOURCES array**

Run: `cd iroyinayo && grep -n "const SOURCES = \[\|^\];" src/modules/content/sources.js | head -5`
Expected: shows the start and end of the array. Note the line number of the closing `];`.

- [ ] **Step 2: Append the 3 new sources**

Open `iroyinayo/src/modules/content/sources.js`. Find the closing `];` of the `SOURCES` array. Before that line, add:

```javascript
  // AI Market Creator additions
  {
    name: 'Goal Nigeria',
    category: 'sports',
    type: 'rss',
    url: 'https://www.goal.com/feeds/en/news?fmt=rss&ICID=AR',
  },
  {
    name: 'Premium Times Politics',
    category: 'politics',
    type: 'rss',
    url: 'https://www.premiumtimesng.com/category/news/top-news/feed',
  },
  {
    name: 'Pulse Nigeria Entertainment',
    category: 'entertainment',
    type: 'rss',
    url: 'https://www.pulse.ng/entertainment/rss',
  },
```

- [ ] **Step 3: Sanity-check**

Run: `cd iroyinayo && node -e "const s = require('./src/modules/content/sources'); const names = s.SOURCES.map(x => x.name); console.log('count:', s.SOURCES.length); console.log('new:', names.filter(n => /Goal Nigeria|Premium Times|Pulse Nigeria/.test(n)));"`
Expected: prints `count: 11` (8 existing + 3 new) and the 3 new names.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo/src/modules/content/sources.js
git commit -m "feat(ai-market): add Goal Nigeria, Premium Times, Pulse Nigeria RSS sources"
```

---

## Task 7: aiMarket service orchestrator

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/aiMarket.service.js`
- Create: `iroyinayo/tests/admin/aiMarket/aiMarket.service.test.js`

**Interfaces:**
- Consumes:
  - `prompts.SYSTEM_PROMPT`, `prompts.buildDraftPrompt`, `prompts.buildTrendPrompt`
  - `validation.validatePrompt`, `validation.validateDraft`, `validation.validateTrendSuggestion`
  - `trendCache.get`, `trendCache.set`
  - `rateLimit.consume`
  - `groqClient.callJSON`
  - `multiMarkets.createMarket`, `multiMarkets.addOutcome`, `multiMarkets.seedMarketLiquidity`, `multiMarkets.getMarketWithOdds`
  - `sources.fetchAllNews`
  - `db` (existing knex instance) for the `multi_markets.description` update.
- Produces:
  - `async function draftMarket({ adminId, prompt })` → `{ title, outcomes, category, closesAt, description, model, latencyMs }`. Throws structured errors: `rate_limit_exceeded`, `invalid_prompt`, `groq_unavailable`, `ai_returned_invalid_response`, `ai_returned_invalid_draft`, `groq_not_configured`.
  - `async function getTrends({ adminId, callJSONFn? })` → `{ trends, fetchedAt, latencyMs, partialFailure, cached }`.
  - `async function publishMarket({ title, outcomes, category, closesAt, description })` → `{ marketId, title, status }`. Throws `invalid_draft` if validation fails.

The `callJSONFn` injection lets tests pass a mock without monkey-patching `require()`.

- [ ] **Step 1: Write failing tests**

Create `iroyinayo/tests/admin/aiMarket/aiMarket.service.test.js`:

```javascript
const db = require('../../../src/config/database');
const service = require('../../../src/modules/admin/aiMarket/aiMarket.service');
const trendCache = require('../../../src/modules/admin/aiMarket/trendCache');
const rateLimit = require('../../../src/modules/admin/aiMarket/rateLimit');
const { randomUUID: uuidv4 } = require('crypto');

beforeEach(() => {
  trendCache._reset();
  rateLimit._reset();
});

function validDraft() {
  return {
    title: 'Will UNILAG beat OAU on Saturday?',
    outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
    category: 'sports',
    closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Resolves to the winner of the UNILAG vs OAU football match.',
  };
}

describe('draftMarket', () => {
  test('returns a valid draft when Groq returns valid JSON', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'llama-3.1-8b-instant', latencyMs: 100 });
    const out = await service.draftMarket({ adminId: 'admin-a', prompt: 'UNILAG vs OAU game', callJSONFn: fakeGroq });
    expect(out.title).toBe(validDraft().title);
    expect(out.model).toBe('llama-3.1-8b-instant');
    expect(out.latencyMs).toBe(100);
  });

  test('throws rate_limit_exceeded when admin exceeds RATE_PER_MIN', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'x', latencyMs: 1 });
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) {
      await service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq });
    }
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/rate_limit_exceeded/);
  });

  test('throws invalid_prompt when prompt fails validation', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'x', latencyMs: 1 });
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'no', callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws ai_returned_invalid_draft when Groq returns invalid category', async () => {
    const bad = { ...validDraft(), category: 'politics' };
    const fakeGroq = async () => ({ parsed: bad, model: 'x', latencyMs: 1 });
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/ai_returned_invalid_draft/);
  });

  test('propagates groq_unavailable from the callJSONFn', async () => {
    const fakeGroq = async () => { throw new Error('groq_unavailable: timeout'); };
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/groq_unavailable/);
  });
});

describe('publishMarket', () => {
  test('creates a market with the draft values and returns the marketId', async () => {
    const draft = validDraft();
    const out = await service.publishMarket(draft);
    expect(out.title).toBe(draft.title);
    expect(out.marketId).toBeDefined();
    expect(out.status).toBe('open');

    const row = await db('multi_markets').where({ id: out.marketId }).first();
    expect(row.title).toBe(draft.title);
    expect(row.category).toBe(draft.category);
    expect(row.description).toBe(draft.description);

    const outcomes = await db('multi_market_outcomes').where({ market_id: out.marketId });
    expect(outcomes.length).toBe(draft.outcomes.length);
  });

  test('throws invalid_draft when category is invalid', async () => {
    const bad = { ...validDraft(), category: 'politics' };
    await expect(service.publishMarket(bad)).rejects.toThrow(/invalid_draft|category/);
  });

  test('throws invalid_draft when title is too short', async () => {
    const bad = { ...validDraft(), title: 'short' };
    await expect(service.publishMarket(bad)).rejects.toThrow(/invalid_draft|title/);
  });

  test('handles missing description (optional field)', async () => {
    const draft = validDraft();
    delete draft.description;
    const out = await service.publishMarket(draft);
    expect(out.marketId).toBeDefined();
  });
});

describe('getTrends', () => {
  test('returns cached result when within TTL', async () => {
    trendCache.set('admin-a', { trends: [{ title: 'cached', source: 's', url: 'https://e.com', category: 'sports' }], fetchedAt: new Date().toISOString(), latencyMs: 10, partialFailure: false });
    const out = await service.getTrends({ adminId: 'admin-a' });
    expect(out.cached).toBe(true);
    expect(out.trends[0].title).toBe('cached');
  });

  test('fetches fresh trends when cache is empty', async () => {
    const fakeGroq = async () => ({
      parsed: [
        { title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' },
      ],
      model: 'x', latencyMs: 50,
    });
    const fakeFetch = async () => ({ sports: [{ title: 'UNILAG vs OAU Saturday', link: 'https://goal.com/x', source: 'Goal Nigeria' }] });
    const out = await service.getTrends({ adminId: 'admin-a', callJSONFn: fakeGroq, fetchAllNewsFn: fakeFetch });
    expect(out.cached).toBe(false);
    expect(out.trends.length).toBe(1);
    expect(out.trends[0].source).toBe('Goal Nigeria');
  });

  test('filters out invalid trend suggestions', async () => {
    const fakeGroq = async () => ({
      parsed: [
        { title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' },
        { title: 'invalid', source: '', url: 'not-a-url', category: 'politics' },
      ],
      model: 'x', latencyMs: 50,
    });
    const fakeFetch = async () => ({ sports: [{ title: 'x', link: 'https://goal.com/x' }] });
    const out = await service.getTrends({ adminId: 'admin-a', callJSONFn: fakeGroq, fetchAllNewsFn: fakeFetch });
    expect(out.trends.length).toBe(1);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd iroyinayo && npm test -- aiMarket.service.test.js`
Expected: FAIL — service module not found.

- [ ] **Step 3: Implement the service**

Create `iroyinayo/src/modules/admin/aiMarket/aiMarket.service.js`:

```javascript
const db = require('../../../config/database');
const multiMarkets = require('../../markets/multiMarkets.service');
const sources = require('../../content/sources');
const prompts = require('./prompts');
const validation = require('./validation');
const trendCache = require('./trendCache');
const rateLimit = require('./rateLimit');
const groqClient = require('./groqClient');

const DRAFT_MAX_TOKENS = 1024;
const TRENDS_MAX_TOKENS = 1500;
const HEADLINE_LIMIT = 30;

class StructuredError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.code = code;
    this.details = details;
  }
}

async function draftMarket({ adminId, prompt, callJSONFn }) {
  const limitCheck = rateLimit.consume(adminId);
  if (!limitCheck.ok) {
    const err = new StructuredError('rate_limit_exceeded', 'rate limit exceeded');
    err.retryAfterSeconds = limitCheck.retryAfterSeconds;
    throw err;
  }

  const promptCheck = validation.validatePrompt(prompt);
  if (!promptCheck.ok) {
    throw new StructuredError('invalid_prompt', promptCheck.error);
  }

  const isoToday = new Date().toISOString().slice(0, 10);
  const userPrompt = prompts.buildDraftPrompt(prompt.trim(), isoToday);
  const callJSON = callJSONFn || groqClient.callJSON;

  let result;
  try {
    result = await callJSON({
      systemPrompt: prompts.SYSTEM_PROMPT,
      userPrompt,
      maxTokens: DRAFT_MAX_TOKENS,
    });
  } catch (err) {
    if (err.message.startsWith('groq_unavailable')) throw new StructuredError('groq_unavailable', err.message);
    if (err.message.startsWith('ai_returned_invalid_response')) throw new StructuredError('ai_returned_invalid_response', err.message);
    if (err.message === 'GROQ_API_KEY is not configured') throw new StructuredError('groq_not_configured', err.message);
    throw err;
  }

  const draftCheck = validation.validateDraft(result.parsed);
  if (!draftCheck.ok) {
    throw new StructuredError('ai_returned_invalid_draft', draftCheck.error, { field: draftCheck.field });
  }

  return {
    ...result.parsed,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

async function publishMarket(draft) {
  const check = validation.validateDraft(draft);
  if (!check.ok) {
    throw new StructuredError('invalid_draft', check.error, { field: check.field });
  }

  const market = await multiMarkets.createMarket(draft.title, null, null);
  await db('multi_markets').where({ id: market.id }).update({
    category: draft.category,
    description: draft.description || null,
    closes_at: new Date(draft.closesAt),
  });

  for (const label of draft.outcomes) {
    if (label.trim()) {
      await multiMarkets.addOutcome(market.id, label.trim());
    }
  }

  await multiMarkets.seedMarketLiquidity(market.id);

  return { marketId: market.id, title: draft.title, status: 'open' };
}

async function getTrends({ adminId, callJSONFn, fetchAllNewsFn }) {
  const cached = trendCache.get(adminId);
  if (cached) {
    return { ...cached, cached: true };
  }

  const fetchFn = fetchAllNewsFn || sources.fetchAllNews;
  const callJSON = callJSONFn || groqClient.callJSON;

  let allNews;
  let partialFailure = false;
  try {
    allNews = await fetchFn();
  } catch (err) {
    partialFailure = true;
    allNews = {};
  }

  // Flatten + trim to top HEADLINE_LIMIT recent items
  const headlines = [];
  for (const arr of Object.values(allNews || {})) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      headlines.push(item);
      if (headlines.length >= HEADLINE_LIMIT) break;
    }
    if (headlines.length >= HEADLINE_LIMIT) break;
  }

  if (headlines.length === 0) {
    const result = { trends: [], fetchedAt: new Date().toISOString(), latencyMs: 0, partialFailure: true };
    trendCache.set(adminId, result);
    return { ...result, cached: false };
  }

  const headlinesJoined = headlines
    .map((h) => `- ${h.title || ''} (${h.source || ''}, ${h.link || ''})`)
    .join('\n');

  const userPrompt = prompts.buildTrendPrompt(headlinesJoined);

  let result;
  try {
    result = await callJSON({
      systemPrompt: prompts.SYSTEM_PROMPT,
      userPrompt,
      maxTokens: TRENDS_MAX_TOKENS,
    });
  } catch (err) {
    throw new StructuredError('groq_unavailable', err.message);
  }

  // The LLM returns either {trends: [...]} or a bare array. Handle both.
  let suggestions = result.parsed;
  if (suggestions && !Array.isArray(suggestions) && Array.isArray(suggestions.trends)) {
    suggestions = suggestions.trends;
  }
  if (!Array.isArray(suggestions)) suggestions = [];

  const valid = suggestions.filter((s) => validation.validateTrendSuggestion(s).ok);

  const out = {
    trends: valid,
    fetchedAt: new Date().toISOString(),
    latencyMs: result.latencyMs,
    partialFailure,
  };
  trendCache.set(adminId, out);
  return { ...out, cached: false };
}

module.exports = { draftMarket, publishMarket, getTrends, StructuredError };
```

- [ ] **Step 4: Verify GREEN**

Run: `cd iroyinayo && npm test -- aiMarket.service.test.js`
Expected: 12/12 tests passing.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/aiMarket.service.js iroyinayo/tests/admin/aiMarket/aiMarket.service.test.js
git commit -m "feat(ai-market): service orchestrator with draft, publish, getTrends"
```

---

## Task 8: Routes + mount in app.js

**Files:**
- Create: `iroyinayo/src/modules/admin/aiMarket/aiMarket.routes.js`
- Modify: `iroyinayo/src/app.js` — register the new router under `/api/admin`.
- Create: `iroyinayo/tests/admin/aiMarket/aiMarket.routes.test.js`

**Interfaces:**
- Consumes: `aiMarket.service`, `authenticate`, `requireRole`.
- Produces: 3 HTTP routes (`POST /admin/ai-market/draft`, `POST /admin/ai-market/trends`, `POST /admin/ai-market/publish`).

- [ ] **Step 1: Write failing route tests**

Create `iroyinayo/tests/admin/aiMarket/aiMarket.routes.test.js`:

```javascript
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../src/app');
const db = require('../../../src/config/database');
const { randomUUID: uuidv4 } = require('crypto');
const aiMarketService = require('../../../src/modules/admin/aiMarket/aiMarket.service');

async function adminToken(role = 'super_admin') {
  const id = uuidv4();
  await db('admins').insert({
    id, email: `a-${id.slice(0, 8)}@t.com`, password_hash: 'x', role, name: 'T',
  });
  return { token: jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret'), id };
}

describe('POST /api/admin/ai-market/draft', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/draft').send({ prompt: 'test prompt here' });
    expect(res.status).toBe(401);
  });

  test('403 when role is not super_admin or moderator', async () => {
    const id = uuidv4();
    await db('admins').insert({ id, email: `v-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'viewer', name: 'V' });
    const token = jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret');
    const res = await request(app)
      .post('/api/admin/ai-market/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'test prompt here' });
    expect(res.status).toBe(403);
  });

  test('400 on invalid prompt', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/admin/ai-market/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'no' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/);
  });

  test('200 with draft when service returns a draft', async () => {
    const fakeDraft = {
      title: 'Will UNILAG beat OAU on Saturday?',
      outcomes: ['UNILAG', 'OAU', 'Draw'],
      category: 'sports',
      closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      description: 'Test description',
      model: 'llama-3.1-8b-instant',
      latencyMs: 120,
    };
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => fakeDraft;
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'UNILAG vs OAU game' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe(fakeDraft.title);
      expect(res.body.outcomes).toEqual(fakeDraft.outcomes);
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });

  test('429 on rate limit exceeded', async () => {
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => {
      const err = new aiMarketService.StructuredError('rate_limit_exceeded', 'too fast');
      err.retryAfterSeconds = 30;
      throw err;
    };
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'test prompt here' });
      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBe(30);
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });

  test('502 when Groq returns invalid draft', async () => {
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => { throw new aiMarketService.StructuredError('ai_returned_invalid_draft', 'bad'); };
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'test prompt here' });
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ai_returned_invalid_draft');
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });
});

describe('POST /api/admin/ai-market/publish', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/publish').send({});
    expect(res.status).toBe(401);
  });

  test('200 and creates a real market when payload is valid', async () => {
    const { token } = await adminToken();
    const draft = {
      title: 'Will UNILAG beat OAU on Saturday?',
      outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
      category: 'sports',
      closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      description: 'Resolves to the winner of the UNILAG vs OAU football match.',
    };
    const res = await request(app)
      .post('/api/admin/ai-market/publish')
      .set('Authorization', `Bearer ${token}`)
      .send(draft);
    expect(res.status).toBe(200);
    expect(res.body.marketId).toBeDefined();
    expect(res.body.status).toBe('open');

    const row = await db('multi_markets').where({ id: res.body.marketId }).first();
    expect(row.description).toBe(draft.description);
  });

  test('400 when category is invalid', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/admin/ai-market/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Will UNILAG beat OAU Saturday?', outcomes: ['a', 'b'], category: 'politics', closesAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/ai-market/trends', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/trends');
    expect(res.status).toBe(401);
  });

  test('200 and returns a trends list', async () => {
    const orig = aiMarketService.getTrends;
    aiMarketService.getTrends = async () => ({
      trends: [{ title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' }],
      fetchedAt: new Date().toISOString(),
      latencyMs: 50,
      partialFailure: false,
      cached: false,
    });
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/trends')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.trends.length).toBe(1);
      expect(res.body.cached).toBe(false);
    } finally {
      aiMarketService.getTrends = orig;
    }
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd iroyinayo && npm test -- aiMarket.routes.test.js`
Expected: FAIL — routes not mounted (404 on all paths).

- [ ] **Step 3: Implement the routes file**

Create `iroyinayo/src/modules/admin/aiMarket/aiMarket.routes.js`:

```javascript
const express = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/adminRole');
const service = require('./aiMarket.service');

const router = express.Router();

function mapErrorToResponse(err, res) {
  if (err.code === 'rate_limit_exceeded') {
    return res.status(429).json({ error: 'rate_limit_exceeded', retryAfter: err.retryAfterSeconds });
  }
  if (err.code === 'invalid_prompt' || err.code === 'invalid_draft') {
    return res.status(400).json({ error: err.code, message: err.message, field: err.details?.field });
  }
  if (err.code === 'groq_not_configured') {
    return res.status(500).json({ error: 'groq_not_configured', message: err.message });
  }
  if (err.code === 'groq_unavailable' || err.code === 'ai_returned_invalid_response' || err.code === 'ai_returned_invalid_draft') {
    return res.status(502).json({ error: err.code, message: err.message, field: err.details?.field });
  }
  return null;
}

router.post('/ai-market/draft', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { prompt } = req.body || {};
    const result = await service.draftMarket({ adminId: req.admin.id, prompt });
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

router.post('/ai-market/trends', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await service.getTrends({ adminId: req.admin.id });
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

router.post('/ai-market/publish', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await service.publishMarket(req.body || {});
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount in app.js**

Open `iroyinayo/src/app.js`. Near the existing admin route requires, add:

```javascript
const aiMarketRoutes = require('./modules/admin/aiMarket/aiMarket.routes');
```

Near the existing `app.use('/api/admin', ...)` mounts, add (after the other admin routes — order doesn't matter, but match the pattern):

```javascript
app.use('/api/admin', aiMarketRoutes);
```

- [ ] **Step 5: Verify GREEN**

Run: `cd iroyinayo && npm test -- aiMarket.routes.test.js`
Expected: 9/9 passing.

- [ ] **Step 6: Run full admin test suite for regression check**

Run: `cd iroyinayo && npm test -- admin`
Expected: all admin/* tests still pass (existing 125 + new ~50). No regressions.

- [ ] **Step 7: Commit**

```bash
git add iroyinayo/src/modules/admin/aiMarket/aiMarket.routes.js iroyinayo/src/app.js iroyinayo/tests/admin/aiMarket/aiMarket.routes.test.js
git commit -m "feat(ai-market): expose /draft, /trends, /publish routes"
```

---

## Task 9: Frontend api.js helpers

**Files:**
- Modify: `iroyinayo-admin/src/lib/api.js` — extend `cc` object.

**Interfaces:**
- Consumes: existing `api.post` helper.
- Produces:
  - `cc.getAIMarketDraft(prompt, { signal })` → `Promise<draft>`. Accepts AbortSignal.
  - `cc.getAIMarketTrends()` → `Promise<{trends, cached, ...}>`.
  - `cc.publishAIMarket(payload)` → `Promise<{marketId, title, status}>`.

The `signal` parameter on the draft helper is what enables in-flight cancellation from the panel's `useDraftRequest` hook.

- [ ] **Step 1: Read existing api.js**

Run: `cd /Users/mac/Documents/claudeCode/new\ p/worktrees/ai-market-creator && head -60 iroyinayo-admin/src/lib/api.js`
Find the `cc` object — confirm it ends with `};`.

- [ ] **Step 2: Inspect `request()` to know how AbortSignal flows**

Run: `cd /Users/mac/Documents/claudeCode/new\ p/worktrees/ai-market-creator && grep -n "signal\|fetch(" iroyinayo-admin/src/lib/api.js`

Note: the existing `request()` does NOT pass through `signal` from caller. We need to extend it OR add a new request helper. The cleanest fix: extend the existing `request()` to accept `options.signal` and pass it through to `fetch()`. Existing callers ignore it; new callers can opt in.

- [ ] **Step 3: Patch `request()` to forward `signal`**

In `iroyinayo-admin/src/lib/api.js`, find the `request` function. The existing call is:

```javascript
const res = await fetch(`${API_URL}${path}`, {
  ...options,
  headers,
});
```

That `...options` ALREADY forwards `signal` to fetch if a caller passes it. No change needed. Confirm by reading the function — if it already spreads `options`, skip this step.

- [ ] **Step 4: Add `api.postWithSignal` wrapper (only if needed)**

If the `cc` helpers need to pass `signal`, they call `request(path, { method: 'POST', body: ..., signal })` directly OR we expose a new helper. Add this to `api.js` after the `api` object:

```javascript
export const apiWithSignal = {
  post: (path, body, signal) => request(path, { method: 'POST', body: JSON.stringify(body), signal }),
};
```

- [ ] **Step 5: Extend the `cc` object**

In `iroyinayo-admin/src/lib/api.js`, find the closing `}` of the `cc` object. Before that, add:

```javascript
  // AI Market Creator helpers
  getAIMarketDraft: (prompt, { signal } = {}) => apiWithSignal.post('/admin/ai-market/draft', { prompt }, signal),
  getAIMarketTrends: () => api.post('/admin/ai-market/trends', {}),
  publishAIMarket: (payload) => api.post('/admin/ai-market/publish', payload),
```

- [ ] **Step 6: Build to verify nothing else broke**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add iroyinayo-admin/src/lib/api.js
git commit -m "feat(ai-market): cc helpers for /draft, /trends, /publish"
```

---

## Task 10: useDraftRequest hook

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/useDraftRequest.js`

**Interfaces:**
- Consumes: `cc.getAIMarketDraft`, `cc.publishAIMarket`.
- Produces: `useDraftRequest()` → `{ state, draft, error, latencyMs, generate(prompt), edit(field, value), publish(), cancel(), discard() }`.

Where `state` is one of `'idle' | 'drafting' | 'preview' | 'publishing' | 'error'` and `draft` is the editable object in State C.

- [ ] **Step 1: Implement the hook**

Create `iroyinayo-admin/src/components/control-center/ai-market-creator/useDraftRequest.js`:

```javascript
'use client';
import { useState, useRef, useCallback } from 'react';
import { cc } from '@/lib/api';

const INITIAL_STATE = 'idle';

export function useDraftRequest() {
  const [state, setState] = useState(INITIAL_STATE);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [originalDraft, setOriginalDraft] = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setState('idle');
    setDraft(null);
    setError(null);
    setLatencyMs(null);
    setOriginalDraft(null);
    abortRef.current = null;
  }, []);

  const generate = useCallback(async (prompt) => {
    abortRef.current = new AbortController();
    setState('drafting');
    setError(null);
    setDraft(null);
    try {
      const result = await cc.getAIMarketDraft(prompt, { signal: abortRef.current.signal });
      const { model, latencyMs: lm, ...rest } = result;
      setDraft(rest);
      setOriginalDraft(rest);
      setLatencyMs(lm);
      setState('preview');
    } catch (err) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
        setState('idle');
        return;
      }
      setError(err.message || 'Failed to generate draft');
      setState('error');
    } finally {
      abortRef.current = null;
    }
  }, []);

  const edit = useCallback((field, value) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }, []);

  const publish = useCallback(async () => {
    if (!draft) return null;
    setState('publishing');
    setError(null);
    try {
      const result = await cc.publishAIMarket(draft);
      reset();
      return result;
    } catch (err) {
      setError(err.message || 'Failed to publish');
      setState('preview');
      return null;
    }
  }, [draft, reset]);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    reset();
  }, [reset]);

  const discard = useCallback(() => {
    reset();
  }, [reset]);

  const fieldsEdited = useCallback(() => {
    if (!draft || !originalDraft) return [];
    const changed = [];
    for (const key of Object.keys(draft)) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(originalDraft[key])) {
        changed.push(key);
      }
    }
    return changed;
  }, [draft, originalDraft]);

  return { state, draft, error, latencyMs, generate, edit, publish, cancel, discard, fieldsEdited };
}
```

- [ ] **Step 2: Build to confirm import resolution**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean (hook isn't imported anywhere yet, but the file must parse).

- [ ] **Step 3: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/ai-market-creator/useDraftRequest.js
git commit -m "feat(ai-market): useDraftRequest state-machine hook"
```

---

## Task 11: PromptInput, OutcomeInputs, DraftPreview, TrendsSection

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/PromptInput.jsx`
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/OutcomeInputs.jsx`
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/DraftPreview.jsx`
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/TrendsSection.jsx`

**Interfaces:**
- `<PromptInput onSubmit={(prompt) => void} disabled={bool} />` — controlled textarea + Draft button.
- `<OutcomeInputs outcomes={string[]} onChange={(newOutcomes) => void} />` — add/remove rows.
- `<DraftPreview draft onChange={(field, value) => void} onPublish={() => Promise<result>} onDiscard={() => void} error={string|null} />`.
- `<TrendsSection onSelectTrend={(trend) => void} disabled={bool} />` — collapsible, polls `cc.getAIMarketTrends()` on expand.

- [ ] **Step 1: Implement PromptInput.jsx**

```jsx
'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function PromptInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 5;
  const canSubmit = trimmed.length >= 5 && trimmed.length <= 500 && !disabled;
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What's trending? e.g., UNILAG vs OAU Saturday, BBNaija eviction tonight"
        maxLength={500}
        rows={3}
        disabled={disabled}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{trimmed.length}/500</span>
        <Button size="sm" disabled={!canSubmit} onClick={() => onSubmit(trimmed)}>
          Draft with AI
        </Button>
      </div>
      {tooShort && <div className="text-xs text-red-600">Prompt must be at least 5 characters.</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement OutcomeInputs.jsx**

```jsx
'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

export function OutcomeInputs({ outcomes, onChange }) {
  const setAt = (idx, value) => {
    const next = [...outcomes];
    next[idx] = value;
    onChange(next);
  };
  const remove = (idx) => {
    if (outcomes.length <= 2) return;
    const next = outcomes.filter((_, i) => i !== idx);
    onChange(next);
  };
  const add = () => {
    if (outcomes.length >= 4) return;
    onChange([...outcomes, '']);
  };
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Outcomes ({outcomes.length})</div>
      {outcomes.map((o, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            value={o}
            onChange={(e) => setAt(idx, e.target.value)}
            maxLength={60}
            placeholder={`Outcome ${idx + 1}`}
          />
          <Button size="sm" variant="ghost" disabled={outcomes.length <= 2} onClick={() => remove(idx)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {outcomes.length < 4 && (
        <Button size="sm" variant="secondary" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Add outcome
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement DraftPreview.jsx**

```jsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { OutcomeInputs } from './OutcomeInputs';

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];

function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DraftPreview({ draft, onChange, onPublish, onDiscard, error }) {
  const [publishing, setPublishing] = useState(false);
  const closesAtLocal = toLocalDatetime(draft.closesAt);
  const closesAtDate = new Date(draft.closesAt);
  const closesPastWarning = !isNaN(closesAtDate.getTime()) && closesAtDate.getTime() < Date.now();

  const canPublish =
    !publishing &&
    typeof draft.title === 'string' &&
    draft.title.trim().length >= 10 &&
    draft.title.trim().length <= 200 &&
    Array.isArray(draft.outcomes) &&
    draft.outcomes.length >= 2 &&
    draft.outcomes.length <= 4 &&
    draft.outcomes.every((o) => o.trim().length > 0 && o.trim().length <= 60) &&
    CATEGORIES.includes(draft.category) &&
    closesAtLocal &&
    !closesPastWarning;

  async function handlePublish() {
    setPublishing(true);
    try { await onPublish(); }
    finally { setPublishing(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input value={draft.title} onChange={(e) => onChange('title', e.target.value)} maxLength={200} />
      </div>

      <OutcomeInputs outcomes={draft.outcomes} onChange={(v) => onChange('outcomes', v)} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">Category</label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={draft.category}
            onChange={(e) => onChange('category', e.target.value)}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Closes at</label>
          <Input
            type="datetime-local"
            value={closesAtLocal}
            onChange={(e) => {
              const d = new Date(e.target.value);
              onChange('closesAt', isNaN(d.getTime()) ? '' : d.toISOString());
            }}
          />
        </div>
      </div>
      {closesPastWarning && <div className="text-xs text-amber-600">Close time is in the past — adjust before publishing.</div>}

      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={draft.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handlePublish} disabled={!canPublish}>
          {publishing ? 'Publishing…' : 'Publish'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={publishing}>Discard</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement TrendsSection.jsx**

```jsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cc } from '@/lib/api';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export function TrendsSection({ onSelectTrend, disabled }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await cc.getAIMarketTrends();
      setTrends(result.trends || []);
      setFetchedAt(result.fetchedAt);
    } catch (err) {
      setError(err.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && trends.length === 0 && !loading) {
      await refresh();
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1 text-sm font-medium"
          onClick={handleToggle}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Trending now
        </button>
        {open && (
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {error && <div className="text-xs text-red-600">{error}</div>}
          {loading && trends.length === 0 && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && trends.length === 0 && !error && (
            <div className="text-xs text-muted-foreground">No trending suggestions right now.</div>
          )}
          {trends.map((t, idx) => (
            <Card key={`${t.url}-${idx}`} className="p-2">
              <div className="text-sm">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.source} · {t.category}</div>
              <Button size="sm" variant="secondary" className="mt-2" disabled={disabled} onClick={() => onSelectTrend(t)}>
                Use this
              </Button>
            </Card>
          ))}
          {fetchedAt && <div className="text-xs text-muted-foreground">Last refreshed: {new Date(fetchedAt).toLocaleTimeString()}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/ai-market-creator/PromptInput.jsx iroyinayo-admin/src/components/control-center/ai-market-creator/OutcomeInputs.jsx iroyinayo-admin/src/components/control-center/ai-market-creator/DraftPreview.jsx iroyinayo-admin/src/components/control-center/ai-market-creator/TrendsSection.jsx
git commit -m "feat(ai-market): PromptInput, OutcomeInputs, DraftPreview, TrendsSection"
```

---

## Task 12: AIMarketCreatorPanel container, wire-in, delete placeholder

**Files:**
- Create: `iroyinayo-admin/src/components/control-center/ai-market-creator/AIMarketCreatorPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx` — update import.
- Delete: `iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx` (the placeholder).

- [ ] **Step 1: Implement AIMarketCreatorPanel.jsx (new version)**

```jsx
'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { useDraftRequest } from './useDraftRequest';
import { PromptInput } from './PromptInput';
import { DraftPreview } from './DraftPreview';
import { TrendsSection } from './TrendsSection';

export function AIMarketCreatorPanel() {
  const { state, draft, error, generate, edit, publish, cancel, discard } = useDraftRequest();
  const drafting = state === 'drafting';
  const previewing = state === 'preview' || state === 'publishing';

  async function handlePublish() {
    const result = await publish();
    return result;
  }

  function handleTrendSelect(trend) {
    generate(trend.title);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div className="font-medium">Create market with AI</div>
      </div>

      {state === 'idle' && (
        <>
          <PromptInput onSubmit={generate} disabled={false} />
          <TrendsSection onSelectTrend={handleTrendSelect} disabled={false} />
        </>
      )}

      {drafting && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="animate-pulse">Drafting market…</span>
          </div>
          <div className="space-y-2 animate-pulse">
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
          </div>
          <Button size="sm" variant="ghost" onClick={cancel}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      )}

      {previewing && draft && (
        <DraftPreview
          draft={draft}
          onChange={edit}
          onPublish={handlePublish}
          onDiscard={discard}
          error={error}
        />
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <div className="text-sm text-red-600">{error}</div>
          <Button size="sm" variant="secondary" onClick={discard}>Reset</Button>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Update TodaysWorkZone import**

In `iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx`, change:

```jsx
import { AIMarketCreatorPanel } from './AIMarketCreatorPanel';
```

to:

```jsx
import { AIMarketCreatorPanel } from './ai-market-creator/AIMarketCreatorPanel';
```

- [ ] **Step 3: Delete the old placeholder**

Run: `cd /Users/mac/Documents/claudeCode/new\ p/worktrees/ai-market-creator && git rm iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx`
Expected: file deleted.

- [ ] **Step 4: Build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/ai-market-creator/AIMarketCreatorPanel.jsx iroyinayo-admin/src/components/control-center/TodaysWorkZone.jsx iroyinayo-admin/src/components/control-center/AIMarketCreatorPanel.jsx
git commit -m "feat(ai-market): AIMarketCreatorPanel container + delete placeholder"
```

---

## Task 13: Telemetry events

**Files:**
- Modify: `iroyinayo-admin/src/components/control-center/ai-market-creator/AIMarketCreatorPanel.jsx`
- Modify: `iroyinayo-admin/src/components/control-center/ai-market-creator/useDraftRequest.js`
- Modify: `iroyinayo-admin/src/components/control-center/ai-market-creator/TrendsSection.jsx`

**Interfaces:** consumes `track` from `@/lib/telemetry` (already in place).

Six events from spec §2.4: `cc_ai_draft_requested`, `cc_ai_draft_received`, `cc_ai_draft_published`, `cc_ai_draft_discarded`, `cc_ai_trend_refresh`, `cc_ai_trend_tapped`.

- [ ] **Step 1: Add tracking inside useDraftRequest**

In `useDraftRequest.js`, at the top:

```javascript
import { track } from '@/lib/telemetry';
```

Modify `generate` to emit `cc_ai_draft_requested` and `cc_ai_draft_received`:

```javascript
const generate = useCallback(async (prompt, opts = {}) => {
  abortRef.current = new AbortController();
  setState('drafting');
  setError(null);
  setDraft(null);
  const startedAt = Date.now();
  track('cc_ai_draft_requested', { prompt_length: prompt.length, seeded_from_trend: !!opts.seededFromTrend });
  try {
    const result = await cc.getAIMarketDraft(prompt, { signal: abortRef.current.signal });
    const { model, latencyMs: lm, ...rest } = result;
    setDraft(rest);
    setOriginalDraft(rest);
    setLatencyMs(lm);
    setState('preview');
    track('cc_ai_draft_received', { latency_ms: lm || (Date.now() - startedAt), outcome_count: rest.outcomes?.length || 0, category: rest.category });
  } catch (err) {
    if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
      setState('idle');
      return;
    }
    setError(err.message || 'Failed to generate draft');
    setState('error');
  } finally {
    abortRef.current = null;
  }
}, []);
```

Modify `publish` to emit `cc_ai_draft_published`:

```javascript
const publish = useCallback(async () => {
  if (!draft) return null;
  setState('publishing');
  setError(null);
  const edited = fieldsEdited();
  try {
    const result = await cc.publishAIMarket(draft);
    track('cc_ai_draft_published', { market_id: result.marketId, category: draft.category, outcome_count: draft.outcomes.length, fields_edited: edited });
    reset();
    return result;
  } catch (err) {
    setError(err.message || 'Failed to publish');
    setState('preview');
    return null;
  }
}, [draft, fieldsEdited, reset]);
```

Modify `discard` to emit `cc_ai_draft_discarded`:

```javascript
const discardStartRef = useRef(null);
// ...inside generate, after setState('preview'): discardStartRef.current = Date.now();

const discard = useCallback(() => {
  if (state === 'preview' && discardStartRef.current) {
    track('cc_ai_draft_discarded', { time_in_preview_seconds: Math.round((Date.now() - discardStartRef.current) / 1000) });
  }
  reset();
}, [reset, state]);
```

(Adjust `discardStartRef` setup so it's set when transitioning to `preview`. Easiest: set inside `generate` right after `setState('preview')`.)

- [ ] **Step 2: Add `cc_ai_trend_refresh` and `cc_ai_trend_tapped` in TrendsSection.jsx**

In `TrendsSection.jsx`, at top:

```javascript
import { track } from '@/lib/telemetry';
```

After the trends fetch in `refresh`:

```javascript
track('cc_ai_trend_refresh', { result_count: (result.trends || []).length, partial_failure: !!result.partialFailure, latency_ms: result.latencyMs, cached: !!result.cached });
```

In the `Use this` button onClick:

```javascript
onClick={() => { track('cc_ai_trend_tapped', { trend_index: idx, category: t.category }); onSelectTrend(t); }}
```

Also pass `seededFromTrend: true` through to `useDraftRequest.generate`. Adjust `AIMarketCreatorPanel`'s `handleTrendSelect`:

```javascript
function handleTrendSelect(trend) {
  generate(trend.title, { seededFromTrend: true });
}
```

(`generate`'s signature in step 1 above already accepts an `opts` arg.)

- [ ] **Step 3: Build**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add iroyinayo-admin/src/components/control-center/ai-market-creator/useDraftRequest.js iroyinayo-admin/src/components/control-center/ai-market-creator/TrendsSection.jsx iroyinayo-admin/src/components/control-center/ai-market-creator/AIMarketCreatorPanel.jsx
git commit -m "feat(ai-market): wire 6 telemetry events"
```

---

## Task 14: Final smoke + verification

**Files:** None new — verification only.

- [ ] **Step 1: Backend tests pass**

Run: `cd iroyinayo && npm test -- "admin/aiMarket"`
Expected: all ~50 new tests pass. (Counts: ~22 validation, ~9 prompts, ~5 trendCache, ~5 rateLimit, ~12 service, ~9 routes.)

- [ ] **Step 2: Full admin suite regression**

Run: `cd iroyinayo && npm test -- admin`
Expected: all admin tests pass (existing 125 + new ~50).

- [ ] **Step 3: Admin app builds**

Run: `cd iroyinayo-admin && npm run build 2>&1 | tail -5`
Expected: clean build.

- [ ] **Step 4: Manual smoke**

Backend: `cd iroyinayo && npm start &` (port 3000).
Admin: `cd iroyinayo-admin && PORT=3001 npm run dev &` (port 3001).
Open: `http://localhost:3001/control-center` after logging in.

Verify:
- AIMarketCreatorPanel renders with the prompt textarea and "Trending now" collapsed.
- Type a prompt like "UNILAG vs OAU football match Saturday"; click Draft with AI; expect a draft to fill in within a few seconds.
- Edit a field; click Publish; expect a "Market published ✓" then panel resets.
- Open `http://localhost:3001/markets` to confirm the new market exists.
- Expand "Trending now"; expect 3–5 suggestions; click "Use this" on one; expect the panel to enter Drafting state.

Kill both servers.

- [ ] **Step 5: Branch review**

Run: `git log --oneline main..HEAD`
Expected: ~14 commits, descriptive messages, no AI attribution.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) | Coverage |
|---|---|---|
| §1 Product thesis | Whole plan | ✓ |
| §2.1 State A | T11 (PromptInput, TrendsSection) + T12 (panel container) | ✓ |
| §2.2 State B | T12 (drafting branch) + T10 (cancel via AbortController) | ✓ |
| §2.3 State C | T11 (DraftPreview, OutcomeInputs) + T10 (state machine) | ✓ |
| §2.4 Six telemetry events | T13 | ✓ |
| §3.1 Three endpoints | T8 | ✓ |
| §3.2 Groq prompt + system + model + temperature | T2 (prompts) + T5 (groqClient) | ✓ |
| §3.3 Three new RSS sources | T6 | ✓ |
| §3.4 Migration 032 | T1 | ✓ |
| §3.5 Cost + rate limits | T4 (rateLimit) + T4 (trendCache) | ✓ |
| §4.1 Draft flow | T7 (service.draftMarket + publishMarket) + T10 (hook) | ✓ |
| §4.2 Trend flow | T7 (service.getTrends) | ✓ |
| §4.3 Validation rules (7 rules) | T3 (validation.js with 22 tests) | ✓ |
| §4.4 Edge cases | T3 (validation) + T10 (cancel) + T13 (telemetry for discard) | ✓ |
| §5 File structure | All tasks | ✓ |
| §6 Error handling table (12 conditions) | T8 (mapErrorToResponse) + T10 (client state) | ✓ |
| §7 Telemetry | T13 | ✓ |
| §8 Success criteria | n/a (observable post-launch) | ✓ |
| §9 Out of scope | n/a | ✓ |
| §10 Risk register | Mitigations distributed across tasks | ✓ |

No gaps.

**2. Placeholder scan:** No "TBD", "TODO", or vague requirements. All steps contain concrete code or commands.

**3. Type consistency:**
- `draftMarket({ adminId, prompt, callJSONFn })` — T7 export, T8 service consumer. ✓
- `publishMarket(draft)` — T7 export, T8 service consumer. ✓
- `getTrends({ adminId, callJSONFn, fetchAllNewsFn })` — T7 export, T8 service consumer. ✓
- `useDraftRequest()` returns `{ state, draft, error, latencyMs, generate, edit, publish, cancel, discard, fieldsEdited }` — T10 export, T12 panel consumer. ✓
- `validateDraft(draft)` → `{ ok, error?, field? }` — T3 export, T7 service consumer. ✓
- `trendCache.get(adminId) / set(adminId, value) / TTL_MS / _reset()` — T4 export, T7 service consumer. ✓
- `rateLimit.consume(adminId)` → `{ ok, retryAfterSeconds? }` — T4 export, T7 service consumer. ✓
- `groqClient.callJSON({ systemPrompt, userPrompt, model, temperature, maxTokens })` → `{ parsed, model, latencyMs }` — T5 export, T7 service consumer. ✓
- `cc.getAIMarketDraft(prompt, { signal })`, `cc.getAIMarketTrends()`, `cc.publishAIMarket(payload)` — T9 export, T10 + T11 + T12 consumers. ✓
- Error codes (`rate_limit_exceeded`, `invalid_prompt`, `invalid_draft`, `groq_unavailable`, `ai_returned_invalid_response`, `ai_returned_invalid_draft`, `groq_not_configured`) — T7 throws, T8 maps to HTTP. ✓

No type mismatches.
