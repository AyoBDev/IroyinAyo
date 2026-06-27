jest.mock('../../src/config/database', () => {
  const data = { students: [], pending_refills: [], point_transactions: [] };
  function db(table) {
    return {
      where(cond) { return chainable(data[table].filter(r => matches(r, cond)), table); },
      whereIn(col, vals) { return chainable(data[table].filter(r => vals.includes(r[col]))); },
      whereNotNull(col) {
        const filtered = data[table].filter(r => r[col] != null);
        return chainable(filtered);
      },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach(r => data[table].push({ id: `${table}-${data[table].length + 1}`, ...r }));
        return Promise.resolve();
      },
    };
  }
  function chainable(rows, tableName) {
    return {
      async first() { return rows[0]; },
      forUpdate() { return this; }, // chainable
      where(cond) { return chainable(rows.filter(r => matches(r, cond)), tableName); },
      whereNotNull(col) { return chainable(rows.filter(r => r[col] != null)); },
      async update(patch) { rows.forEach(r => Object.assign(r, patch)); return rows.length; },
      async select() { return rows; },
      count(col) {
        const key = col ? col.split(' as ')[1] || 'count' : 'count';
        const countResult = [{ [key]: rows.length }];
        return {
          async first() { return countResult[0]; }
        };
      },
      orderBy() { return this; },
      limit() { return this; },
      async increment(col, amount) {
        // Find and update the original rows in the table data
        rows.forEach(targetRow => {
          if (tableName && data[tableName]) {
            const originalRow = data[tableName].find(r => r.id === targetRow.id);
            if (originalRow) {
              originalRow[col] = (originalRow[col] || 0) + amount;
            }
          }
        });
        return Promise.resolve();
      },
    };
  }
  function matches(row, cond) {
    return Object.entries(cond).every(([k, v]) => row[k] === v);
  }
  db.transaction = async (cb) => cb(db);
  db.__data = data;
  db.__reset = () => { data.students = []; data.pending_refills = []; data.point_transactions = []; };
  return db;
});

const db = require('../../src/config/database');
const { getPending, claim, getMondayInWAT } = require('../../src/modules/refills/refill.service');

beforeEach(() => db.__reset());

test('getPending returns null when no unclaimed refill', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  const result = await getPending({ studentId: 'stu-1' });
  expect(result).toEqual({ pending: null, refillsRemaining: 3 });
});

test('getPending returns unclaimed row', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  db.__data.pending_refills.push({
    id: 'p1', student_id: 'stu-1', amount: 80, claimed_at: null, week_starting: getMondayInWAT(),
  });
  const result = await getPending({ studentId: 'stu-1' });
  expect(result.pending).toEqual({ id: 'p1', amount: 80 });
  expect(result.refillsRemaining).toBe(3);
});

test('getPending refillsRemaining reflects claimed-this-week count', async () => {
  const monday = getMondayInWAT();
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  db.__data.pending_refills.push({ id: 'p1', student_id: 'stu-1', amount: 80, claimed_at: new Date(), week_starting: monday });
  db.__data.pending_refills.push({ id: 'p2', student_id: 'stu-1', amount: 80, claimed_at: new Date(), week_starting: monday });
  const result = await getPending({ studentId: 'stu-1' });
  expect(result.refillsRemaining).toBe(1);
});

test('claim credits balance and marks claimed', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  db.__data.pending_refills.push({
    id: 'p1', student_id: 'stu-1', amount: 80, claimed_at: null, week_starting: getMondayInWAT(),
  });
  const result = await claim({ studentId: 'stu-1', refillId: 'p1' });
  expect(result).toEqual({ ok: true, amount: 80, newBalance: 80 });
  expect(db.__data.students[0].points_balance).toBe(80);
  expect(db.__data.pending_refills[0].claimed_at).toBeTruthy();
  expect(db.__data.point_transactions.length).toBe(1);
  expect(db.__data.point_transactions[0]).toMatchObject({ student_id: 'stu-1', amount: 80, type: 'daily_refill' });
});

test('claim returns ALREADY_CLAIMED when row is already claimed', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 50 });
  db.__data.pending_refills.push({
    id: 'p1', student_id: 'stu-1', amount: 80, claimed_at: new Date(), week_starting: getMondayInWAT(),
  });
  const result = await claim({ studentId: 'stu-1', refillId: 'p1' });
  expect(result).toEqual({ ok: false, code: 'ALREADY_CLAIMED' });
  expect(db.__data.students[0].points_balance).toBe(50);
});

test('claim returns ALREADY_CLAIMED when row does not exist', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  const result = await claim({ studentId: 'stu-1', refillId: 'nope' });
  expect(result).toEqual({ ok: false, code: 'ALREADY_CLAIMED' });
});

test('claim returns ALREADY_CLAIMED when row belongs to a different student', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  db.__data.students.push({ id: 'stu-2', points_balance: 0 });
  db.__data.pending_refills.push({
    id: 'p1', student_id: 'stu-2', amount: 80, claimed_at: null, week_starting: getMondayInWAT(),
  });
  const result = await claim({ studentId: 'stu-1', refillId: 'p1' });
  expect(result).toEqual({ ok: false, code: 'ALREADY_CLAIMED' });
});

test('claim clamps amount to MAX_POINTS_BALANCE', async () => {
  db.__data.students.push({ id: 'stu-1', points_balance: 1990 });
  db.__data.pending_refills.push({
    id: 'p1', student_id: 'stu-1', amount: 80, claimed_at: null, week_starting: getMondayInWAT(),
  });
  const result = await claim({ studentId: 'stu-1', refillId: 'p1' });
  expect(result).toEqual({ ok: true, amount: 10, newBalance: 2000 });
  expect(db.__data.students[0].points_balance).toBe(2000);
});

test('claim returns WEEKLY_CAP_REACHED when already at 3 claims', async () => {
  const monday = getMondayInWAT();
  db.__data.students.push({ id: 'stu-1', points_balance: 0 });
  for (let i = 0; i < 3; i++) {
    db.__data.pending_refills.push({ id: `c${i}`, student_id: 'stu-1', amount: 80, claimed_at: new Date(), week_starting: monday });
  }
  // A 4th unclaimed row exists (shouldn't ever happen given issuer constraints, but defensive)
  db.__data.pending_refills.push({ id: 'p4', student_id: 'stu-1', amount: 80, claimed_at: null, week_starting: monday });
  const result = await claim({ studentId: 'stu-1', refillId: 'p4' });
  expect(result).toEqual({ ok: false, code: 'WEEKLY_CAP_REACHED' });
  // The row should be consumed (marked claimed) to prevent retries.
  const row = db.__data.pending_refills.find(p => p.id === 'p4');
  expect(row.claimed_at).toBeTruthy();
});
