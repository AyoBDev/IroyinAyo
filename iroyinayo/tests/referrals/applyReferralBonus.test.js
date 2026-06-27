jest.mock('../../src/config/database', () => {
  const mockData = { students: [], referrals: [], point_transactions: [] };

  function chainable(rows, tableName) {
    return {
      where(cond) {
        if (typeof cond === 'string') {
          // Handle .where('created_at', '>', dateObj) style calls
          return chainable(rows, tableName);
        }
        const filtered = rows.filter(r => Object.entries(cond).every(([k, v]) => r[k] === v));
        return chainable(filtered, tableName);
      },
      forUpdate() {
        return chainable(rows, tableName);
      },
      insert(payload) {
        const items = Array.isArray(payload) ? payload : [payload];
        items.forEach(r => mockData[tableName].push({ ...r }));
        return Promise.resolve();
      },
      async first() { return rows[0]; },
      async update(patch) { rows.forEach(r => Object.assign(r, patch)); return rows.length; },
      async increment(col, n) { rows.forEach(r => { r[col] = (r[col] || 0) + n; }); return rows.length; },
      count(expr) { 
        return chainable([{ count: rows.length }], tableName);
      },
      sum(expr) { 
        return chainable([{ total: 0 }], tableName);
      },
    };
  }

  function db(table) {
    return chainable(mockData[table] || [], table);
  }

  db.transaction = async (cb) => cb(db);
  db.__data = mockData;
  db.__reset = () => {
    mockData.students = [];
    mockData.referrals = [];
    mockData.point_transactions = [];
  };

  return db;
});

jest.mock('../../src/utils/posthog', () => ({ capture: jest.fn() }));

const db = require('../../src/config/database');
const { applyReferral } = require('../../src/modules/referrals/referrals.service');

beforeEach(() => {
  db.__reset();
  db.__data.students.push({ id: 'ref1', name: 'Referrer', referral_code: 'ABCDE', points_balance: 100, is_banned: false });
  db.__data.students.push({ id: 'new1', name: 'NewUser', points_balance: 100, is_banned: false });
});

test('referrer balance increases by 50', async () => {
  await applyReferral('new1', 'ABCDE');
  const referrer = db.__data.students.find(s => s.id === 'ref1');
  expect(referrer.points_balance).toBe(150);
});

test('referred user balance is unchanged (still 100)', async () => {
  await applyReferral('new1', 'ABCDE');
  const newUser = db.__data.students.find(s => s.id === 'new1');
  expect(newUser.points_balance).toBe(100);
});

test('point_transactions has one referral row for the referrer, none for the referred user', async () => {
  await applyReferral('new1', 'ABCDE');
  const referralRows = db.__data.point_transactions.filter(t => t.type === 'referral');
  expect(referralRows.length).toBe(1);
  expect(referralRows[0].student_id).toBe('ref1');
  expect(referralRows[0].amount).toBe(50);
});

test('referrals row records referred_bonus as 0', async () => {
  await applyReferral('new1', 'ABCDE');
  expect(db.__data.referrals.length).toBe(1);
  expect(db.__data.referrals[0]).toMatchObject({
    referrer_id: 'ref1',
    referred_id: 'new1',
    referrer_bonus: 50,
    referred_bonus: 0,
  });
});
