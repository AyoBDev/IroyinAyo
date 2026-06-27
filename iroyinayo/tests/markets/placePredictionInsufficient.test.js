jest.mock('../../src/config/database', () => {
  const data = {
    students: [{ id: 's1', points_balance: 50, is_system: false }],
    multi_markets: [{ id: 'm1', status: 'open', liquidity_b: 100, title: 'Test' }],
    multi_market_outcomes: [
      { id: 'o1', market_id: 'm1', shares_sold: 0, created_at: new Date() },
      { id: 'o2', market_id: 'm1', shares_sold: 0, created_at: new Date() },
    ],
    multi_market_positions: [],
    point_transactions: [],
  };
  function db(table) {
    return {
      where(cond) { return chainable(data[table].filter(r => Object.entries(cond).every(([k, v]) => r[k] === v))); },
      orderBy() { return this; },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach(r => data[table].push({ ...r }));
        return { returning: async () => rows };
      },
    };
  }
  function chainable(rows) {
    const obj = {
      async first() { return rows[0]; },
      forUpdate() { return obj; },
      async update(patch) { rows.forEach(r => Object.assign(r, patch)); return rows.length; },
      async increment(col, n) { rows.forEach(r => { r[col] = (r[col] || 0) + n; }); return rows.length; },
      async decrement(col, n) { rows.forEach(r => { r[col] = (r[col] || 0) - n; }); return rows.length; },
      count(col) {
        obj._countCol = col;
        return obj;
      },
      orderBy() { return obj; },
      async select() { return rows; },
      then(resolve) { resolve(rows); }, // for await
    };
    // Make first() work after count() by returning the count result
    const originalFirst = obj.first;
    obj.first = async function() {
      if (obj._countCol) {
        const countResult = {};
        const colName = obj._countCol.split(' as ')[1] || 'count';
        countResult[colName] = rows.length;
        return countResult;
      }
      return originalFirst.call(this);
    };
    return obj;
  }
  db.transaction = async (cb) => cb(db);
  db.__data = data;
  return db;
});

jest.mock('../../src/utils/posthog', () => ({ capture: jest.fn() }));

const db = require('../../src/config/database');
const { buyPosition } = require('../../src/modules/markets/multiMarkets.service');

test('throws Insufficient points before mutating any DB state', async () => {
  await expect(
    buyPosition('m1', 'o1', 's1', 100, null, false)
  ).rejects.toMatchObject({
    code: 'INSUFFICIENT_POINTS',
    balance: 50,
    attempted: 100,
  });

  // No state mutated.
  expect(db.__data.multi_market_positions.length).toBe(0);
  expect(db.__data.point_transactions.length).toBe(0);
  const outcome = db.__data.multi_market_outcomes.find(o => o.id === 'o1');
  expect(outcome.shares_sold).toBe(0);
});

test('does NOT pre-flight-check system seed', async () => {
  db.__data.students.push({ id: 'sys', points_balance: 0, is_system: true });
  // Should not throw INSUFFICIENT_POINTS for a system seed.
  await expect(
    buyPosition('m1', 'o1', 'sys', 100, null, true)
  ).resolves.toBeDefined();
});
