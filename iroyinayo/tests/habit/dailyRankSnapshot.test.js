const db = require('../../src/config/database');
const { snapshotDailyRanks } = require('../../src/modules/habit/dailyRankSnapshot');
const { randomUUID: uuidv4 } = require('crypto');

async function createStudent(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 10000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
    is_system: false,
    is_banned: false,
    ...overrides,
  });
  return id;
}

async function createMarket() {
  const marketId = uuidv4();
  await db('multi_markets').insert({
    id: marketId,
    title: `T ${marketId.slice(0, 8)}`,
    status: 'open',
    category: 'football',
    liquidity_b: 100,
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

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

describe('snapshotDailyRanks', () => {
  test('snapshots all eligible students with sequential ranks starting at 1', async () => {
    const s1 = await createStudent({ points_balance: 1000 });
    const s2 = await createStudent({ points_balance: 2000 });
    const s3 = await createStudent({ points_balance: 1500 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await snapshotDailyRanks({ date: today });
    expect(result.snapshotted).toBe(3);

    const snapshots = await db('daily_rank_snapshots')
      .where('snapshot_date', today)
      .orderBy('rank', 'asc');
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0].rank).toBe(1);
    expect(snapshots[1].rank).toBe(2);
    expect(snapshots[2].rank).toBe(3);
  });

  test('rank order matches net_profit DESC, then wins DESC', async () => {
    const s1 = await createStudent({ points_balance: 1000 });
    const s2 = await createStudent({ points_balance: 1000 });
    const s3 = await createStudent({ points_balance: 1000 });
    const { marketId, outcomeId } = await createMarket();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = getWeekStart(today);

    // s1: 500 net profit, 1 win
    await db('multi_market_positions').insert({
      id: uuidv4(),
      student_id: s1,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 10,
      amount: 500,
      payout: 1000,
      created_at: new Date(weekStart.getTime() + 1000),
    });

    // s2: 500 net profit, 2 wins (should rank higher than s1)
    await db('multi_market_positions').insert([
      {
        id: uuidv4(),
        student_id: s2,
        market_id: marketId,
        outcome_id: outcomeId,
        shares: 5,
        amount: 250,
        payout: 500,
        created_at: new Date(weekStart.getTime() + 2000),
      },
      {
        id: uuidv4(),
        student_id: s2,
        market_id: marketId,
        outcome_id: outcomeId,
        shares: 5,
        amount: 250,
        payout: 500,
        created_at: new Date(weekStart.getTime() + 3000),
      },
    ]);

    // s3: 200 net profit (should rank last)
    await db('multi_market_positions').insert({
      id: uuidv4(),
      student_id: s3,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 4,
      amount: 200,
      payout: 400,
      created_at: new Date(weekStart.getTime() + 4000),
    });

    await snapshotDailyRanks({ date: today });

    const snapshots = await db('daily_rank_snapshots')
      .where('snapshot_date', today)
      .orderBy('rank', 'asc');

    expect(snapshots[0].student_id).toBe(s2); // rank 1: 500 profit, 2 wins
    expect(snapshots[1].student_id).toBe(s1); // rank 2: 500 profit, 1 win
    expect(snapshots[2].student_id).toBe(s3); // rank 3: 200 profit
  });

  test('re-running on the same date is idempotent', async () => {
    const s1 = await createStudent({ points_balance: 1000 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await snapshotDailyRanks({ date: today });
    const first = await db('daily_rank_snapshots').where('snapshot_date', today);
    expect(first).toHaveLength(1);

    await snapshotDailyRanks({ date: today });
    const second = await db('daily_rank_snapshots').where('snapshot_date', today);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
  });

  test('excludes is_system and is_banned students', async () => {
    const s1 = await createStudent({ points_balance: 1000 });
    const s2 = await createStudent({ points_balance: 2000, is_system: true });
    const s3 = await createStudent({ points_balance: 1500, is_banned: true });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await snapshotDailyRanks({ date: today });
    expect(result.snapshotted).toBe(1);

    const snapshots = await db('daily_rank_snapshots').where('snapshot_date', today);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].student_id).toBe(s1);
  });
});
