jest.mock('../../src/config/database', () => {
  const data = { students: [], point_transactions: [] };
  function db(table) {
    return {
      where(cond) { return chainable(data[table].filter(r => Object.entries(cond).every(([k, v]) => r[k] === v))); },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach(r => data[table].push({ ...r }));
        return Promise.resolve();
      },
    };
  }
  function chainable(rows) {
    return {
      where(cond) { return chainable(rows.filter(r => Object.entries(cond).every(([k, v]) => r[k] === v))); },
      forUpdate() { return this; },
      async first() { return rows[0]; },
      async update(patch) { rows.forEach(r => Object.assign(r, patch)); return rows.length; },
      async increment(col, n) { rows.forEach(r => { r[col] = (r[col] || 0) + n; }); return rows.length; },
      async decrement(col, n) { rows.forEach(r => { r[col] = (r[col] || 0) - n; }); return rows.length; },
    };
  }
  db.transaction = async (cb) => cb(db);
  db.__data = data;
  db.__reset = () => { data.students = []; data.point_transactions = []; };
  return db;
});

const db = require('../../src/config/database');
const { deductPoints } = require('../../src/modules/gamification/gamification.service');

beforeEach(() => db.__reset());

test('deductPoints throws Insufficient points when amount exceeds balance', async () => {
  db.__data.students.push({ id: 's1', points_balance: 50, is_system: false });
  await expect(deductPoints('s1', 100, 'multi_market', 'test')).rejects.toThrow(/Insufficient points/);
});

test('deductPoints does NOT write an auto_refill row', async () => {
  db.__data.students.push({ id: 's1', points_balance: 50, is_system: false });
  try { await deductPoints('s1', 100, 'multi_market', 'test'); } catch {}
  expect(db.__data.point_transactions.filter(r => r.type === 'auto_refill').length).toBe(0);
});

test('deductPoints does NOT mutate balance when insufficient', async () => {
  db.__data.students.push({ id: 's1', points_balance: 50, is_system: false });
  try { await deductPoints('s1', 100, 'multi_market', 'test'); } catch {}
  expect(db.__data.students[0].points_balance).toBe(50);
});

test('deductPoints succeeds normally when balance is sufficient', async () => {
  db.__data.students.push({ id: 's1', points_balance: 200, is_system: false });
  await deductPoints('s1', 100, 'multi_market', 'test');
  expect(db.__data.students[0].points_balance).toBe(100);
  expect(db.__data.point_transactions.length).toBe(1);
  expect(db.__data.point_transactions[0]).toMatchObject({ student_id: 's1', amount: -100, type: 'multi_market' });
});
