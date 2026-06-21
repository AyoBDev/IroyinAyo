const db = require('../../src/config/database');
const { buildDailyQueue, pickAnchorTime, jitterScheduledFor } = require('../../src/modules/habit/queueBuilder');
const { randomUUID: uuidv4 } = require('crypto');

function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

async function createEnrolledStudent(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 10000)}`,
    name: 'Test',
    is_onboarded: true,
    is_banned: false,
    wa_daily_enabled: true,
    wa_anchor_time: '08:00:00',
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

async function createMarket({ status = 'open', closesAt = null } = {}) {
  const marketId = uuidv4();
  await db('multi_markets').insert({
    id: marketId,
    title: `Test Market ${marketId.slice(0, 8)}`,
    status,
    category: 'football',
    liquidity_b: 100,
    closes_at: closesAt,
  });
  const outcomeId = uuidv4();
  await db('multi_market_outcomes').insert({
    id: outcomeId,
    market_id: marketId,
    label: 'YES',
    shares_sold: 0,
  });
  return { marketId, outcomeId };
}

async function createCuriosityLede() {
  // Create a hot market with 60+ predictions in the last 24h to trigger curiosity lede
  const { marketId, outcomeId } = await createMarket({ status: 'open' });
  const students = [];
  for (let i = 0; i < 60; i++) {
    const studentId = uuidv4();
    await db('students').insert({
      id: studentId,
      phone_number: `234${Date.now()}${i}`,
      name: 'Predictor',
      is_onboarded: true,
      points_balance: 1000,
    });
    students.push(studentId);
  }
  const now = new Date();
  for (const studentId of students) {
    await db('multi_market_positions').insert({
      id: uuidv4(),
      student_id: studentId,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 5,
      amount: 250,
      created_at: now,
    });
  }
  return { marketId, outcomeId };
}

describe('pickAnchorTime', () => {
  test('returns HH:MM:SS string in 7:00-9:30 window', () => {
    const t = pickAnchorTime(fixedRng([0]));
    expect(t).toBe('07:00:00');
    const t2 = pickAnchorTime(fixedRng([0.999]));
    const [h, m] = t2.split(':').map(Number);
    expect(h * 60 + m).toBeLessThanOrEqual(9 * 60 + 30);
    expect(h * 60 + m).toBeGreaterThanOrEqual(7 * 60);
  });
});

describe('jitterScheduledFor', () => {
  test('jitters within ±25 minutes', () => {
    const target = new Date('2026-06-22T00:00:00Z');
    const t1 = jitterScheduledFor('08:00:00', target, fixedRng([0]));
    const t2 = jitterScheduledFor('08:00:00', target, fixedRng([1]));
    const span = (t2.getTime() - t1.getTime()) / 60000;
    expect(span).toBeCloseTo(50, 0);
  });
});

describe('buildDailyQueue', () => {
  test('enqueues a row for each eligible student', async () => {
    await createCuriosityLede();
    await createMarket({ status: 'open' });
    await createMarket({ status: 'open' });
    await createMarket({ status: 'open' });
    await createEnrolledStudent();
    await createEnrolledStudent();
    await createEnrolledStudent({ wa_daily_enabled: false });
    const result = await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    expect(result.enqueued).toBe(2);
    const rows = await db('whatsapp_daily_queue').select('*');
    expect(rows.length).toBe(2);
  });

  test('skips paused users', async () => {
    await createCuriosityLede();
    await createMarket({ status: 'open' });
    await createMarket({ status: 'open' });
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEnrolledStudent({ wa_paused_until: future });
    await createEnrolledStudent();
    const result = await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    expect(result.enqueued).toBe(1);
  });

  test('writes lede_type and markets line', async () => {
    await createCuriosityLede();
    await createMarket({ status: 'open' });
    await createMarket({ status: 'open' });
    await createEnrolledStudent();
    await buildDailyQueue({ targetDate: new Date('2026-06-22') });
    const row = await db('whatsapp_daily_queue').first();
    expect(row.markets).toBeDefined();
    expect(Array.isArray(row.markets)).toBe(true);
  });
});
