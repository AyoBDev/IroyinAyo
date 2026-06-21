const db = require('../../src/config/database');
const { pickLede } = require('../../src/modules/habit/ledePicker');
const { randomUUID: uuidv4 } = require('crypto');

async function createStudent() {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 10000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
  });
  return id;
}

async function createMarket({ status = 'open', closesAt = null, category = 'football' } = {}) {
  const marketId = uuidv4();
  await db('multi_markets').insert({
    id: marketId,
    title: `T ${marketId.slice(0, 8)}`,
    status,
    category,
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

describe('pickLede', () => {
  test('returns rank lede when leaderboard moved 3+', async () => {
    const studentId = await createStudent();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    await db('daily_rank_snapshots').insert([
      { id: uuidv4(), student_id: studentId, rank: 50, snapshot_date: yesterday, points_balance: 0, net_profit_week: 0 },
      { id: uuidv4(), student_id: studentId, rank: 45, snapshot_date: today, points_balance: 0, net_profit_week: 0 },
    ]);
    const r = await pickLede(studentId);
    expect(r.type).toBe('rank');
    expect(r.payload.rankDelta).toBe(5);
    expect(r.payload.currentRank).toBe(45);
  });

  test('returns resolution lede when open position resolves in next 24h', async () => {
    const studentId = await createStudent();
    const closesAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const { marketId, outcomeId } = await createMarket({ status: 'open', closesAt });
    await db('multi_market_positions').insert({
      id: uuidv4(),
      student_id: studentId,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 5,
      amount: 250,
    });
    const r = await pickLede(studentId);
    expect(r.type).toBe('resolution');
    expect(r.payload.count).toBeGreaterThanOrEqual(1);
  });

  test('returns curiosity lede when no priority 1-3 matches but a hot market exists', async () => {
    const studentId = await createStudent();
    const { marketId, outcomeId } = await createMarket({ status: 'open' });
    for (let i = 0; i < 60; i++) {
      const otherStudent = await createStudent();
      await db('multi_market_positions').insert({
        id: uuidv4(),
        student_id: otherStudent,
        market_id: marketId,
        outcome_id: outcomeId,
        shares: 1,
        amount: 50,
      });
    }
    const r = await pickLede(studentId);
    expect(r.type).toBe('curiosity');
    expect(r.payload.marketId).toBe(marketId);
  });

  test('returns null when no condition holds and no curiosity market qualifies', async () => {
    const studentId = await createStudent();
    const r = await pickLede(studentId);
    expect(r.type).toBeNull();
  });
});
