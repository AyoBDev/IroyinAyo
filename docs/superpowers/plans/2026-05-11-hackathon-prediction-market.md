# Hackathon Prediction Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WhatsApp bot on a separate branch that lets hackathon spectators predict 1st/2nd/3rd place winners using a multi-outcome LMSR market maker with play money.

**Architecture:** Fork from main into `hackathon-predictions` branch. Strip unused modules (quiz, rewards, content, interests). Add multi-outcome LMSR market service, new DB migration, simplified message handler with zero-friction auto-registration, and admin commands for team/market management.

**Tech Stack:** Node.js, Express, Knex (Postgres), Baileys (WhatsApp), Jest (tests)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `migrations/010_create_multi_markets.js` | Multi-outcome market tables |
| `src/modules/markets/multiMarkets.service.js` | Multi-outcome LMSR math + market CRUD |
| `src/bot/handlers/multiPredict.js` | Spectator flow: view markets, place bets, check positions |
| `src/bot/admin/hackathonAdmin.js` | Admin commands: addteam, removeteam, resolve, markets |
| `src/bot/hackathonMessageHandler.js` | Simplified router: auto-register + route to predict/admin |
| `tests/multiMarkets.service.test.js` | Unit tests for LMSR math and service |
| `tests/bot/multiPredict.test.js` | Handler tests |
| `tests/bot/hackathonAdmin.test.js` | Admin handler tests |

### Modified files

| File | Change |
|------|--------|
| `src/bot/index.js` | Swap `messageHandler` import to `hackathonMessageHandler` |
| `src/bot/formatters.js` | Add multi-market formatting functions |

---

## Task 1: Create branch and migration

**Files:**
- Create: `migrations/010_create_multi_markets.js`

- [ ] **Step 1: Create the hackathon-predictions branch**

```bash
git checkout -b hackathon-predictions
```

- [ ] **Step 2: Write the migration file**

```javascript
// migrations/010_create_multi_markets.js
exports.up = function (knex) {
  return knex.schema
    .createTable('multi_markets', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('title').notNullable();
      table.string('status').notNullable().defaultTo('open');
      table.integer('liquidity_b').notNullable().defaultTo(100);
      table.uuid('winning_outcome_id');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('resolved_at');
    })
    .createTable('multi_market_outcomes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
      table.string('label').notNullable();
      table.float('shares_sold').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    })
    .createTable('multi_market_positions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('market_id').notNullable().references('id').inTable('multi_markets').onDelete('CASCADE');
      table.uuid('outcome_id').notNullable().references('id').inTable('multi_market_outcomes').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.integer('amount').notNullable();
      table.float('shares').notNullable();
      table.integer('payout').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('multi_market_positions')
    .dropTableIfExists('multi_market_outcomes')
    .dropTableIfExists('multi_markets');
};
```

- [ ] **Step 3: Run the migration**

```bash
npx knex migrate:latest
```

Expected: Migration runs successfully, creates 3 new tables.

- [ ] **Step 4: Commit**

```bash
git add migrations/010_create_multi_markets.js
git commit -m "feat: add multi-outcome market tables migration"
```

---

## Task 2: Multi-outcome LMSR service (math + CRUD)

**Files:**
- Create: `src/modules/markets/multiMarkets.service.js`
- Test: `tests/multiMarkets.service.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/multiMarkets.service.test.js
const db = require('../src/config/database');

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await db('multi_market_positions').del();
  await db('multi_market_outcomes').del();
  await db('multi_markets').del();
  await db('point_transactions').del();
  await db('students').del();
});

const multiMarkets = require('../src/modules/markets/multiMarkets.service');

describe('LMSR math', () => {
  test('prices sum to 1 for any number of outcomes', () => {
    const shares = [0, 0, 0, 0, 0];
    const b = 100;
    const prices = multiMarkets.calculatePrices(shares, b);
    const sum = prices.reduce((a, c) => a + c, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  test('equal shares produce equal prices', () => {
    const shares = [0, 0, 0];
    const b = 100;
    const prices = multiMarkets.calculatePrices(shares, b);
    expect(prices[0]).toBeCloseTo(1 / 3, 5);
    expect(prices[1]).toBeCloseTo(1 / 3, 5);
    expect(prices[2]).toBeCloseTo(1 / 3, 5);
  });

  test('buying shares increases that outcome price', () => {
    const shares = [10, 0, 0];
    const b = 100;
    const prices = multiMarkets.calculatePrices(shares, b);
    expect(prices[0]).toBeGreaterThan(1 / 3);
    expect(prices[1]).toBeLessThan(1 / 3);
  });

  test('calculateCost returns positive cost for buying', () => {
    const shares = [0, 0, 0];
    const b = 100;
    const cost = multiMarkets.calculateCost(shares, b, 0, 10);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(10);
  });

  test('calculateSharesForAmount returns correct shares via binary search', () => {
    const shares = [0, 0, 0];
    const b = 100;
    const amount = 30;
    const n = multiMarkets.calculateSharesForAmount(shares, b, 0, amount);
    const actualCost = multiMarkets.calculateCost(shares, b, 0, n);
    expect(actualCost).toBeCloseTo(amount, 1);
  });
});

describe('market CRUD', () => {
  test('createMarket creates a market with given title', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st place?');
    expect(market.title).toBe('Who wins 1st place?');
    expect(market.status).toBe('open');
    expect(market.liquidity_b).toBe(100);
  });

  test('addOutcome adds a team to a market', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    const outcome = await multiMarkets.addOutcome(market.id, 'Team Alpha');
    expect(outcome.label).toBe('Team Alpha');
    expect(outcome.shares_sold).toBe(0);
  });

  test('getMarketWithOdds returns market with prices', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');
    const result = await multiMarkets.getMarketWithOdds(market.id);
    expect(result.outcomes.length).toBe(2);
    expect(result.outcomes[0].price).toBeCloseTo(0.5, 2);
  });
});

describe('buying positions', () => {
  let student;

  beforeEach(async () => {
    [student] = await db('students')
      .insert({ phone_number: '2348001234567', name: 'Test', is_onboarded: true, points_balance: 100 })
      .returning('*');
  });

  test('buyPosition deducts points and records shares', async () => {
    const market = await multiMarkets.createMarket('Who wins?');
    const outcome = await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    const result = await multiMarkets.buyPosition(market.id, outcome.id, student.id, 30);
    expect(result.position.amount).toBe(30);
    expect(result.position.shares).toBeGreaterThan(0);

    const updatedStudent = await db('students').where({ id: student.id }).first();
    expect(updatedStudent.points_balance).toBe(70);
  });

  test('buyPosition rejects insufficient points', async () => {
    const market = await multiMarkets.createMarket('Who wins?');
    const outcome = await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    await expect(multiMarkets.buyPosition(market.id, outcome.id, student.id, 200))
      .rejects.toThrow('Insufficient points');
  });
});

describe('resolving markets', () => {
  let student;

  beforeEach(async () => {
    [student] = await db('students')
      .insert({ phone_number: '2348001234567', name: 'Test', is_onboarded: true, points_balance: 100 })
      .returning('*');
  });

  test('resolve pays 1 point per winning share', async () => {
    const market = await multiMarkets.createMarket('Who wins?');
    const outcomeA = await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    await multiMarkets.buyPosition(market.id, outcomeA.id, student.id, 30);

    await multiMarkets.resolveMarket(market.id, outcomeA.id);

    const updatedStudent = await db('students').where({ id: student.id }).first();
    const position = await db('multi_market_positions').where({ student_id: student.id }).first();
    expect(position.payout).toBe(Math.floor(position.shares));
    expect(updatedStudent.points_balance).toBe(100 - 30 + Math.floor(position.shares));
  });

  test('resolve gives 0 to losers', async () => {
    const market = await multiMarkets.createMarket('Who wins?');
    const outcomeA = await multiMarkets.addOutcome(market.id, 'Team A');
    const outcomeB = await multiMarkets.addOutcome(market.id, 'Team B');

    await multiMarkets.buyPosition(market.id, outcomeA.id, student.id, 30);
    await multiMarkets.resolveMarket(market.id, outcomeB.id);

    const updatedStudent = await db('students').where({ id: student.id }).first();
    expect(updatedStudent.points_balance).toBe(70);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest tests/multiMarkets.service.test.js --no-coverage
```

Expected: All tests fail — module not found.

- [ ] **Step 3: Implement the multi-outcome LMSR service**

```javascript
// src/modules/markets/multiMarkets.service.js
const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const gamificationService = require('../gamification/gamification.service');

const DEFAULT_B = 100;

function logSumExp(values) {
  const max = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + Math.exp(v - max), 0);
  return max + Math.log(sum);
}

function calculatePrices(sharesSold, b) {
  const exps = sharesSold.map((q) => q / b);
  const lse = logSumExp(exps);
  return exps.map((e) => Math.exp(e - lse));
}

function costFunction(sharesSold, b) {
  const exps = sharesSold.map((q) => q / b);
  return b * logSumExp(exps);
}

function calculateCost(sharesSold, b, outcomeIndex, n) {
  const before = costFunction(sharesSold, b);
  const after_shares = [...sharesSold];
  after_shares[outcomeIndex] += n;
  const after = costFunction(after_shares, b);
  return after - before;
}

function calculateSharesForAmount(sharesSold, b, outcomeIndex, amount) {
  let lo = 0;
  let hi = b * 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateCost(sharesSold, b, outcomeIndex, mid);
    if (cost < amount) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

async function createMarket(title, liquidityB = DEFAULT_B) {
  const [market] = await db('multi_markets')
    .insert({ title, liquidity_b: liquidityB })
    .returning('*');
  return market;
}

async function addOutcome(marketId, label) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'open') throw new ValidationError('Market is not open');

  const [outcome] = await db('multi_market_outcomes')
    .insert({ market_id: marketId, label })
    .returning('*');
  return outcome;
}

async function removeOutcome(marketId, outcomeId) {
  const positions = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: outcomeId })
    .first();
  if (positions) throw new ValidationError('Cannot remove outcome with existing bets');

  const deleted = await db('multi_market_outcomes')
    .where({ id: outcomeId, market_id: marketId })
    .del();
  if (!deleted) throw new NotFoundError('Outcome not found');
}

async function getMarketWithOdds(marketId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');

  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  const sharesSold = outcomes.map((o) => o.shares_sold);
  const prices = outcomes.length > 0
    ? calculatePrices(sharesSold, market.liquidity_b)
    : [];

  return {
    ...market,
    outcomes: outcomes.map((o, i) => ({ ...o, price: prices[i] || 0 })),
  };
}

async function listOpenMarkets() {
  const markets = await db('multi_markets').where({ status: 'open' }).orderBy('created_at', 'asc');
  const result = [];
  for (const market of markets) {
    const outcomes = await db('multi_market_outcomes')
      .where({ market_id: market.id })
      .orderBy('created_at', 'asc');
    const sharesSold = outcomes.map((o) => o.shares_sold);
    const prices = outcomes.length > 0
      ? calculatePrices(sharesSold, market.liquidity_b)
      : [];
    result.push({
      ...market,
      outcomes: outcomes.map((o, i) => ({ ...o, price: prices[i] || 0 })),
    });
  }
  return result;
}

async function buyPosition(marketId, outcomeId, studentId, amount) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status !== 'open') throw new ValidationError('Market is not open');
  if (amount < 1) throw new ValidationError('Amount must be at least 1');

  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: marketId })
    .orderBy('created_at', 'asc');

  if (outcomes.length < 2) throw new ValidationError('Market needs at least 2 outcomes');

  const outcomeIndex = outcomes.findIndex((o) => o.id === outcomeId);
  if (outcomeIndex === -1) throw new NotFoundError('Outcome not found in this market');

  await gamificationService.deductPoints(studentId, amount, 'market_buy',
    `Bet on: ${outcomes[outcomeIndex].label} in ${market.title}`, marketId);

  const sharesSold = outcomes.map((o) => o.shares_sold);
  const shares = calculateSharesForAmount(sharesSold, market.liquidity_b, outcomeIndex, amount);

  await db('multi_market_outcomes')
    .where({ id: outcomeId })
    .increment('shares_sold', shares);

  const [position] = await db('multi_market_positions')
    .insert({ market_id: marketId, outcome_id: outcomeId, student_id: studentId, amount, shares })
    .returning('*');

  const updatedMarket = await getMarketWithOdds(marketId);
  return { position, market: updatedMarket };
}

async function resolveMarket(marketId, winningOutcomeId) {
  const market = await db('multi_markets').where({ id: marketId }).first();
  if (!market) throw new NotFoundError('Market not found');
  if (market.status === 'resolved') throw new ValidationError('Market already resolved');

  const outcome = await db('multi_market_outcomes')
    .where({ id: winningOutcomeId, market_id: marketId }).first();
  if (!outcome) throw new NotFoundError('Winning outcome not found in this market');

  const winningPositions = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: winningOutcomeId });

  for (const position of winningPositions) {
    const payout = Math.floor(position.shares);
    if (payout > 0) {
      await gamificationService.addPoints(position.student_id, payout, 'market_win',
        `Won: ${outcome.label} in ${market.title}`, marketId);
      await db('multi_market_positions').where({ id: position.id }).update({ payout });
    }
  }

  await db('multi_markets').where({ id: marketId }).update({
    status: 'resolved',
    winning_outcome_id: winningOutcomeId,
    resolved_at: new Date(),
  });

  return getMarketWithOdds(marketId);
}

async function getStudentPositions(studentId) {
  return db('multi_market_positions')
    .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
    .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
    .where({ 'multi_market_positions.student_id': studentId })
    .select(
      'multi_market_positions.*',
      'multi_markets.title as market_title',
      'multi_markets.status as market_status',
      'multi_market_outcomes.label as outcome_label'
    )
    .orderBy('multi_market_positions.created_at', 'desc');
}

module.exports = {
  calculatePrices,
  calculateCost,
  calculateSharesForAmount,
  createMarket,
  addOutcome,
  removeOutcome,
  getMarketWithOdds,
  listOpenMarkets,
  buyPosition,
  resolveMarket,
  getStudentPositions,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest tests/multiMarkets.service.test.js --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/markets/multiMarkets.service.js tests/multiMarkets.service.test.js
git commit -m "feat: add multi-outcome LMSR market service with tests"
```

---

## Task 3: Formatters for multi-outcome markets

**Files:**
- Modify: `src/bot/formatters.js`

- [ ] **Step 1: Add multi-market formatting functions to formatters.js**

Append these functions and update the exports:

```javascript
function formatMultiMarketList(markets) {
  if (markets.length === 0) return '📊 No markets set up yet. Check back soon!';
  const lines = markets.map((m, i) => {
    const teamCount = m.outcomes.length;
    return `${i + 1}️⃣ ${bold(m.title)} (${teamCount} teams)`;
  });
  return [
    bold('🏆 Hackathon Prediction Markets'),
    '',
    ...lines,
    '',
    `Reply with a number to see odds and bet.`,
    `Type ${bold('leaderboard')} for rankings.`,
    `Type ${bold('my bets')} to see your positions.`,
    `Type ${bold('balance')} to check your points.`,
  ].join('\n');
}

function formatMultiMarketOdds(market) {
  if (market.outcomes.length === 0) {
    return `📊 ${bold(market.title)}\n\nNo teams added yet.`;
  }
  const lines = market.outcomes.map((o, i) => {
    const cents = Math.round(o.price * 100);
    return `${i + 1}. ${o.label} — ${cents}¢`;
  });
  return [
    `📊 ${bold(market.title)}`,
    '',
    ...lines,
    '',
    `Reply: ${bold('bet [team#] [amount]')}`,
    `Example: ${bold('bet 1 30')}`,
    '',
    `Type ${bold('back')} to return to markets.`,
  ].join('\n');
}

function formatMultiPositions(positions) {
  if (positions.length === 0) return 'You have no bets yet. Type *predict* to get started!';
  const lines = positions.map((p) => {
    const status = p.market_status === 'resolved'
      ? (p.payout > 0 ? `✅ Won ${p.payout} pts` : '❌ Lost')
      : `⏳ ${p.outcome_label} — ${p.amount} pts (${p.shares.toFixed(1)} shares)`;
    return `${bold(p.market_title)}\n${status}`;
  });
  return `${bold('🔮 My Bets')}\n\n${lines.join('\n\n')}`;
}
```

Add to module.exports: `formatMultiMarketList, formatMultiMarketOdds, formatMultiPositions`

- [ ] **Step 2: Commit**

```bash
git add src/bot/formatters.js
git commit -m "feat: add multi-market formatting functions"
```

---

## Task 4: Spectator predict handler

**Files:**
- Create: `src/bot/handlers/multiPredict.js`
- Test: `tests/bot/multiPredict.test.js`

- [ ] **Step 1: Write the handler tests**

```javascript
// tests/bot/multiPredict.test.js
const { handleMultiPredict, handleMultiPredictAction } = require('../../src/bot/handlers/multiPredict');
const multiMarkets = require('../../src/modules/markets/multiMarkets.service');
const db = require('../../src/config/database');

beforeAll(async () => { await db.migrate.latest(); });
afterAll(async () => { await db.destroy(); });

beforeEach(async () => {
  await db('multi_market_positions').del();
  await db('multi_market_outcomes').del();
  await db('multi_markets').del();
  await db('point_transactions').del();
  await db('students').del();
});

function mockSock() {
  return { sendMessage: jest.fn().mockResolvedValue(undefined) };
}

describe('handleMultiPredict', () => {
  test('shows market list when markets exist', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    const sock = mockSock();
    const setState = jest.fn();
    await handleMultiPredict(sock, 'jid@s.whatsapp.net', null, setState);

    expect(sock.sendMessage).toHaveBeenCalled();
    const text = sock.sendMessage.mock.calls[0][1].text;
    expect(text).toContain('Who wins 1st?');
    expect(setState).toHaveBeenCalledWith('jid@s.whatsapp.net', 'predict', 'browsing', {});
  });

  test('shows no markets message when empty', async () => {
    const sock = mockSock();
    const setState = jest.fn();
    await handleMultiPredict(sock, 'jid@s.whatsapp.net', null, setState);

    const text = sock.sendMessage.mock.calls[0][1].text;
    expect(text).toContain('No markets');
  });
});

describe('handleMultiPredictAction', () => {
  let student;

  beforeEach(async () => {
    [student] = await db('students')
      .insert({ phone_number: '2348001234567', name: 'Test', is_onboarded: true, points_balance: 100 })
      .returning('*');
  });

  test('selecting a market number shows odds', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    const sock = mockSock();
    const setState = jest.fn();
    const clearState = jest.fn();
    const state = { flow: 'predict', step: 'browsing', data: {} };

    await handleMultiPredictAction(sock, 'jid', '1', student, state, setState, clearState);

    const text = sock.sendMessage.mock.calls[0][1].text;
    expect(text).toContain('Team A');
    expect(text).toContain('Team B');
    expect(setState).toHaveBeenCalledWith('jid', 'predict', 'viewing', expect.objectContaining({ marketId: market.id }));
  });

  test('bet command places a position', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    const outcomeA = await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');

    const sock = mockSock();
    const setState = jest.fn();
    const clearState = jest.fn();
    const state = { flow: 'predict', step: 'viewing', data: { marketId: market.id } };

    await handleMultiPredictAction(sock, 'jid', 'bet 1 30', student, state, setState, clearState);

    const text = sock.sendMessage.mock.calls[0][1].text;
    expect(text).toContain('Bet placed');
    expect(clearState).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/bot/multiPredict.test.js --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler**

```javascript
// src/bot/handlers/multiPredict.js
const multiMarkets = require('../../modules/markets/multiMarkets.service');
const { formatMultiMarketList, formatMultiMarketOdds, formatMultiPositions, bold } = require('../formatters');

async function handleMultiPredict(sock, jid, student, setState) {
  const markets = await multiMarkets.listOpenMarkets();

  const text = formatMultiMarketList(markets);
  await sock.sendMessage(jid, { text });

  if (markets.length > 0) {
    setState(jid, 'predict', 'browsing', {});
  }
}

async function handleMultiPredictAction(sock, jid, text, student, state, setState, clearState) {
  const lower = text.toLowerCase().trim();

  if (lower === 'back' || lower === 'menu') {
    clearState(jid);
    const markets = await multiMarkets.listOpenMarkets();
    if (state.step === 'viewing') {
      await sock.sendMessage(jid, { text: formatMultiMarketList(markets) });
      setState(jid, 'predict', 'browsing', {});
    } else {
      await sock.sendMessage(jid, { text: formatMultiMarketList(markets) });
    }
    return;
  }

  if (state.step === 'browsing') {
    const num = parseInt(lower, 10);
    if (isNaN(num) || num < 1) {
      await sock.sendMessage(jid, { text: 'Reply with a market number, or type *back*.' });
      return;
    }

    const markets = await multiMarkets.listOpenMarkets();
    if (num > markets.length) {
      await sock.sendMessage(jid, { text: `Invalid number. Choose 1-${markets.length}.` });
      return;
    }

    const market = markets[num - 1];
    const full = await multiMarkets.getMarketWithOdds(market.id);
    await sock.sendMessage(jid, { text: formatMultiMarketOdds(full) });
    setState(jid, 'predict', 'viewing', { marketId: market.id });
    return;
  }

  if (state.step === 'viewing') {
    const betMatch = lower.match(/^bet\s+(\d+)\s+(\d+)$/);
    if (!betMatch) {
      await sock.sendMessage(jid, {
        text: `Reply: ${bold('bet [team#] [amount]')} or ${bold('back')} to return.`,
      });
      return;
    }

    const teamNum = parseInt(betMatch[1], 10);
    const amount = parseInt(betMatch[2], 10);
    const market = await multiMarkets.getMarketWithOdds(state.data.marketId);

    if (teamNum < 1 || teamNum > market.outcomes.length) {
      await sock.sendMessage(jid, { text: `Invalid team number. Choose 1-${market.outcomes.length}.` });
      return;
    }

    const outcome = market.outcomes[teamNum - 1];

    try {
      const result = await multiMarkets.buyPosition(market.id, outcome.id, student.id, amount);
      const sharesReceived = result.position.shares.toFixed(1);
      const potentialPayout = Math.floor(result.position.shares);
      const profit = potentialPayout - amount;

      const newPrice = result.market.outcomes.find((o) => o.id === outcome.id);
      const cents = newPrice ? Math.round(newPrice.price * 100) : '?';

      await sock.sendMessage(jid, {
        text: [
          `✅ ${bold('Bet placed!')}`,
          '',
          `📌 ${bold('Market:')} ${market.title}`,
          `🎯 ${bold('Team:')} ${outcome.label}`,
          `💸 ${bold('Spent:')} ${amount} pts`,
          `📈 ${bold('Shares:')} ${sharesReceived}`,
          `🏆 ${bold('If they win:')} ${potentialPayout} pts (profit: ${profit} pts)`,
          `⚖️ ${bold('New odds:')} ${outcome.label} ${cents}¢`,
          '',
          `💰 ${bold('Balance:')} ${student.points_balance - amount} pts remaining`,
        ].join('\n'),
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ ${err.message}` });
    }

    clearState(jid);
    return;
  }
}

async function handleMyBets(sock, jid, student) {
  const positions = await multiMarkets.getStudentPositions(student.id);
  await sock.sendMessage(jid, { text: formatMultiPositions(positions) });
}

module.exports = { handleMultiPredict, handleMultiPredictAction, handleMyBets };
```

- [ ] **Step 4: Run the tests**

```bash
npx jest tests/bot/multiPredict.test.js --no-coverage
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/bot/handlers/multiPredict.js tests/bot/multiPredict.test.js
git commit -m "feat: add spectator prediction handler for multi-outcome markets"
```

---

## Task 5: Admin handler for hackathon

**Files:**
- Create: `src/bot/admin/hackathonAdmin.js`
- Test: `tests/bot/hackathonAdmin.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/bot/hackathonAdmin.test.js
const { handleHackathonAdmin } = require('../../src/bot/admin/hackathonAdmin');
const multiMarkets = require('../../src/modules/markets/multiMarkets.service');
const db = require('../../src/config/database');

beforeAll(async () => { await db.migrate.latest(); });
afterAll(async () => { await db.destroy(); });

beforeEach(async () => {
  await db('multi_market_positions').del();
  await db('multi_market_outcomes').del();
  await db('multi_markets').del();
  await db('students').del();
});

function mockSock() {
  return { sendMessage: jest.fn().mockResolvedValue(undefined) };
}

describe('hackathon admin', () => {
  test('/addteam adds team to market', async () => {
    const market = await multiMarkets.createMarket('Who wins 1st?');
    const markets = await multiMarkets.listOpenMarkets();

    const sock = mockSock();
    await handleHackathonAdmin(sock, 'jid', '/addteam 1 Team Alpha');

    const updated = await multiMarkets.getMarketWithOdds(market.id);
    expect(updated.outcomes.length).toBe(1);
    expect(updated.outcomes[0].label).toBe('Team Alpha');
  });

  test('/resolve resolves market and pays winners', async () => {
    const [student] = await db('students')
      .insert({ phone_number: '2348001234567', name: 'Test', is_onboarded: true, points_balance: 100 })
      .returning('*');

    const market = await multiMarkets.createMarket('Who wins 1st?');
    const outcomeA = await multiMarkets.addOutcome(market.id, 'Team A');
    await multiMarkets.addOutcome(market.id, 'Team B');
    await multiMarkets.buyPosition(market.id, outcomeA.id, student.id, 30);

    const sock = mockSock();
    await handleHackathonAdmin(sock, 'jid', '/resolve 1 1');

    const resolved = await db('multi_markets').where({ id: market.id }).first();
    expect(resolved.status).toBe('resolved');
  });

  test('/markets lists all markets', async () => {
    await multiMarkets.createMarket('Who wins 1st?');
    await multiMarkets.createMarket('Who wins 2nd?');

    const sock = mockSock();
    await handleHackathonAdmin(sock, 'jid', '/markets');

    const text = sock.sendMessage.mock.calls[0][1].text;
    expect(text).toContain('1st');
    expect(text).toContain('2nd');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx jest tests/bot/hackathonAdmin.test.js --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the admin handler**

```javascript
// src/bot/admin/hackathonAdmin.js
const multiMarkets = require('../../modules/markets/multiMarkets.service');
const gamificationService = require('../../modules/gamification/gamification.service');
const db = require('../../config/database');
const { bold } = require('../formatters');

async function handleHackathonAdmin(sock, jid, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/addteam':
      await handleAddTeam(sock, jid, parts);
      break;
    case '/removeteam':
      await handleRemoveTeam(sock, jid, parts);
      break;
    case '/resolve':
      await handleResolve(sock, jid, parts);
      break;
    case '/markets':
      await handleListMarkets(sock, jid);
      break;
    case '/addpoints':
      await handleAddPoints(sock, jid, parts);
      break;
    case '/setup':
      await handleSetup(sock, jid);
      break;
    default:
      await sock.sendMessage(jid, {
        text: [
          bold('Admin Commands:'),
          '/setup — Create the 3 default markets (1st, 2nd, 3rd)',
          '/addteam [market#] [Team Name] — Add team to a market',
          '/removeteam [market#] [team#] — Remove team (no bets)',
          '/resolve [market#] [team#] — Resolve market',
          '/markets — List all markets',
          '/addpoints [phone] [amount] — Give points',
        ].join('\n'),
      });
  }
}

async function handleSetup(sock, jid) {
  const existing = await db('multi_markets').count('id as count').first();
  if (parseInt(existing.count, 10) > 0) {
    await sock.sendMessage(jid, { text: 'Markets already exist. Use /markets to view them.' });
    return;
  }

  await multiMarkets.createMarket('Who will win 1st place?');
  await multiMarkets.createMarket('Who will win 2nd place?');
  await multiMarkets.createMarket('Who will win 3rd place?');

  await sock.sendMessage(jid, {
    text: `✅ Created 3 markets (1st, 2nd, 3rd place).\nNow use ${bold('/addteam [market#] [Team Name]')} to add teams.`,
  });
}

async function handleAddTeam(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /addteam [market#] [Team Name]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamName = parts.slice(2).join(' ');

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number. You have ${markets.length} markets.` });
    return;
  }

  const market = markets[marketNum - 1];

  try {
    await multiMarkets.addOutcome(market.id, teamName);
    const updated = await multiMarkets.getMarketWithOdds(market.id);
    await sock.sendMessage(jid, {
      text: `✅ Added ${bold(teamName)} to ${bold(market.title)}\nNow has ${updated.outcomes.length} teams.`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleRemoveTeam(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /removeteam [market#] [team#]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamNum = parseInt(parts[2], 10);

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number.` });
    return;
  }

  const market = markets[marketNum - 1];
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: market.id })
    .orderBy('created_at', 'asc');

  if (isNaN(teamNum) || teamNum < 1 || teamNum > outcomes.length) {
    await sock.sendMessage(jid, { text: `Invalid team number.` });
    return;
  }

  try {
    await multiMarkets.removeOutcome(market.id, outcomes[teamNum - 1].id);
    await sock.sendMessage(jid, { text: `✅ Removed ${bold(outcomes[teamNum - 1].label)} from ${bold(market.title)}` });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleResolve(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /resolve [market#] [team#]' });
    return;
  }

  const marketNum = parseInt(parts[1], 10);
  const teamNum = parseInt(parts[2], 10);

  const markets = await db('multi_markets').orderBy('created_at', 'asc');
  if (isNaN(marketNum) || marketNum < 1 || marketNum > markets.length) {
    await sock.sendMessage(jid, { text: `Invalid market number.` });
    return;
  }

  const market = markets[marketNum - 1];
  const outcomes = await db('multi_market_outcomes')
    .where({ market_id: market.id })
    .orderBy('created_at', 'asc');

  if (isNaN(teamNum) || teamNum < 1 || teamNum > outcomes.length) {
    await sock.sendMessage(jid, { text: `Invalid team number.` });
    return;
  }

  try {
    const resolved = await multiMarkets.resolveMarket(market.id, outcomes[teamNum - 1].id);
    await sock.sendMessage(jid, {
      text: `✅ ${bold(market.title)} resolved!\nWinner: ${bold(outcomes[teamNum - 1].label)}`,
    });
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${err.message}` });
  }
}

async function handleListMarkets(sock, jid) {
  const markets = await multiMarkets.listOpenMarkets();
  const all = await db('multi_markets').orderBy('created_at', 'asc');

  const lines = all.map((m, i) => {
    const marketWithOdds = markets.find((om) => om.id === m.id);
    const teamCount = marketWithOdds ? marketWithOdds.outcomes.length : 0;
    const statusEmoji = m.status === 'resolved' ? '✅' : '🟢';
    return `${i + 1}. ${statusEmoji} ${m.title} (${teamCount} teams) [${m.status}]`;
  });

  await sock.sendMessage(jid, {
    text: [bold('📊 All Markets'), '', ...lines].join('\n'),
  });
}

async function handleAddPoints(sock, jid, parts) {
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: 'Usage: /addpoints [phone] [amount]' });
    return;
  }

  const phone = parts[1];
  const amount = parseInt(parts[2], 10);
  if (isNaN(amount) || amount <= 0) {
    await sock.sendMessage(jid, { text: 'Amount must be a positive number.' });
    return;
  }

  const student = await db('students').where({ phone_number: phone }).first();
  if (!student) {
    await sock.sendMessage(jid, { text: 'Student not found.' });
    return;
  }

  await gamificationService.addPoints(student.id, amount, 'admin_grant', 'Admin top-up');
  await sock.sendMessage(jid, { text: `✅ Added ${amount} pts to ${bold(student.name)} (${phone})` });
}

module.exports = { handleHackathonAdmin };
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/bot/hackathonAdmin.test.js --no-coverage
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/bot/admin/hackathonAdmin.js tests/bot/hackathonAdmin.test.js
git commit -m "feat: add hackathon admin commands for team/market management"
```

---

## Task 6: Simplified message handler with auto-registration

**Files:**
- Create: `src/bot/hackathonMessageHandler.js`

- [ ] **Step 1: Write the simplified handler**

```javascript
// src/bot/hackathonMessageHandler.js
const db = require('../config/database');
const gamificationService = require('../modules/gamification/gamification.service');
const { handleMultiPredict, handleMultiPredictAction, handleMyBets } = require('./handlers/multiPredict');
const { handleHackathonAdmin } = require('./admin/hackathonAdmin');
const { formatLeaderboard, formatPoints, bold } = require('./formatters');

const conversationState = new Map();
const STARTING_POINTS = 100;

function getState(jid) {
  return conversationState.get(jid) || null;
}

function setState(jid, flow, step, data = {}) {
  conversationState.set(jid, { flow, step, data });
}

function clearState(jid) {
  conversationState.delete(jid);
}

const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || '').split(',').filter(Boolean);

async function autoRegister(phone, jid) {
  const [student] = await db('students')
    .insert({
      phone_number: phone,
      name: phone,
      is_onboarded: true,
      points_balance: STARTING_POINTS,
    })
    .returning('*');

  await db('point_transactions').insert({
    student_id: student.id,
    amount: STARTING_POINTS,
    type: 'signup_bonus',
    description: 'Welcome bonus',
  });

  return student;
}

async function handleMessage(sock, jid, text, msg) {
  const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');

  if (text.startsWith('/') && ADMIN_NUMBERS.includes(phone)) {
    await handleHackathonAdmin(sock, jid, text);
    return;
  }

  let student = await db('students').where({ phone_number: phone }).first();

  if (!student) {
    student = await autoRegister(phone, jid);
  }

  if (student.whatsapp_jid !== jid) {
    await db('students').where({ id: student.id }).update({ whatsapp_jid: jid });
  }

  const state = getState(jid);
  if (state && state.flow === 'predict') {
    await handleMultiPredictAction(sock, jid, text, student, state, setState, clearState);
    return;
  }

  const command = text.toLowerCase().trim();

  switch (command) {
    case 'leaderboard':
      const entries = await gamificationService.getLeaderboard('weekly', 10);
      await sock.sendMessage(jid, { text: formatLeaderboard(entries) });
      break;
    case 'my bets':
    case 'mybets':
    case 'my predictions':
      await handleMyBets(sock, jid, student);
      break;
    case 'balance':
    case 'points':
      const updated = await db('students').where({ id: student.id }).first();
      await sock.sendMessage(jid, { text: formatPoints(updated.points_balance) });
      break;
    default:
      await handleMultiPredict(sock, jid, student, setState);
      break;
  }
}

module.exports = { handleMessage, conversationState, getState, setState, clearState };
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/hackathonMessageHandler.js
git commit -m "feat: add simplified hackathon message handler with auto-registration"
```

---

## Task 7: Wire up the new handler in bot/index.js

**Files:**
- Modify: `src/bot/index.js`

- [ ] **Step 1: Read current bot/index.js to understand the import**

Look for the line that imports `messageHandler` and swap it.

- [ ] **Step 2: Change the import in src/bot/index.js**

Replace:
```javascript
const { handleMessage } = require('./messageHandler');
```

With:
```javascript
const { handleMessage } = require('./hackathonMessageHandler');
```

- [ ] **Step 3: Run the full test suite to check nothing breaks**

```bash
npx jest --no-coverage
```

Expected: Existing tests that don't depend on the old message handler pass. Some old handler tests may fail (that's expected — they test the disabled features).

- [ ] **Step 4: Commit**

```bash
git add src/bot/index.js
git commit -m "feat: wire hackathon message handler into bot entry point"
```

---

## Task 8: End-to-end manual verification

- [ ] **Step 1: Start the bot locally**

```bash
npm start
```

- [ ] **Step 2: Test admin setup**

Send from admin number:
- `/setup` — should create 3 markets
- `/addteam 1 Team Alpha` — adds to 1st place market
- `/addteam 1 Team Beta` — adds another team
- `/addteam 2 Team Alpha` — adds to 2nd place market
- `/addteam 2 Team Beta`
- `/markets` — should list all with team counts

- [ ] **Step 3: Test spectator flow**

Send from non-admin number:
- Any text (e.g., "hi") — should auto-register and show markets
- `1` — should show 1st place odds
- `bet 1 30` — should place bet on Team Alpha
- `balance` — should show 70 pts
- `my bets` — should show the position
- `leaderboard` — should show rankings

- [ ] **Step 4: Test resolution**

From admin:
- `/resolve 1 1` — resolve 1st place, Team Alpha wins
- Check spectator's balance increased

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjustments from manual testing"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Branch + DB migration |
| 2 | Multi-outcome LMSR service (core math + CRUD) |
| 3 | Formatter functions for multi-markets |
| 4 | Spectator predict handler |
| 5 | Admin commands |
| 6 | Simplified message handler with auto-registration |
| 7 | Wire into bot entry point |
| 8 | Manual end-to-end verification |
