const db = require('../../src/config/database');
const { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank } = require('../../src/modules/habit/accuracy');
const { randomUUID: uuidv4 } = require('crypto');

async function createResolvedMarket({ category, winningLabel, outcomes = ['YES', 'NO'] }) {
  const marketId = uuidv4();
  const outcomeRows = [];
  for (const label of outcomes) {
    const id = uuidv4();
    outcomeRows.push({ id, market_id: marketId, label, shares_sold: 0 });
  }
  const winningOutcome = outcomeRows.find((o) => o.label === winningLabel);

  await db('multi_markets').insert({
    id: marketId,
    title: `Test market ${marketId.slice(0, 8)}`,
    category,
    status: 'resolved',
    resolved_at: new Date(),
    liquidity_b: 100,
    winning_outcome_id: winningOutcome.id,
  });
  await db('multi_market_outcomes').insert(outcomeRows);
  return { marketId, outcomes: outcomeRows };
}

async function createStudent(overrides = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

async function placePosition({ studentId, marketId, outcomeId, shares, payout = 0 }) {
  await db('multi_market_positions').insert({
    id: uuidv4(),
    student_id: studentId,
    market_id: marketId,
    outcome_id: outcomeId,
    shares,
    amount: shares * 50,
    payout,
  });
}

describe('computeAccuracy', () => {
  test('returns null accuracy when fewer than 3 resolved calls', async () => {
    const studentId = await createStudent();
    const { marketId, outcomes } = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId, outcomeId: outcomes[0].id, shares: 10, payout: 500 });

    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(1);
    expect(result.accuracy).toBeNull();
  });

  test('counts correct calls when 3+ resolved', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 3; i++) {
      const { marketId, outcomes } = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId, outcomeId: outcomes[0].id, shares: 10, payout: 500 });
    }
    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3);
    expect(result.correct).toBe(3);
    expect(result.accuracy).toBeCloseTo(1.0);
  });

  test('collapses multiple buys on same outcome to one call', async () => {
    const studentId = await createStudent();
    const market1 = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market1.marketId, outcomeId: market1.outcomes[0].id, shares: 5, payout: 250 });
    await placePosition({ studentId, marketId: market1.marketId, outcomeId: market1.outcomes[0].id, shares: 5, payout: 250 });
    const market2 = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market2.marketId, outcomeId: market2.outcomes[0].id, shares: 10, payout: 500 });
    const market3 = await createResolvedMarket({ category: 'football', winningLabel: 'NO' });
    await placePosition({ studentId, marketId: market3.marketId, outcomeId: market3.outcomes[0].id, shares: 10, payout: 0 });

    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3);
    expect(result.correct).toBe(2);
  });

  test('excludes net-flat (arbitrage) positions', async () => {
    const studentId = await createStudent();
    const market = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
    await placePosition({ studentId, marketId: market.marketId, outcomeId: market.outcomes[0].id, shares: 10, payout: 500 });
    await placePosition({ studentId, marketId: market.marketId, outcomeId: market.outcomes[1].id, shares: 10, payout: 0 });
    // Add 3 more clean calls so accuracy doesn't return null
    for (let i = 0; i < 3; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeAccuracy(studentId);
    expect(result.resolvedCalls).toBe(3); // arbitrage market excluded
  });
});

describe('computeCategoryAccuracy', () => {
  test('omits categories with fewer than 5 resolved calls', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 4; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeCategoryAccuracy(studentId);
    expect(result.find((r) => r.category === 'football')).toBeUndefined();
  });

  test('includes categories with 5+ resolved calls', async () => {
    const studentId = await createStudent();
    for (let i = 0; i < 5; i++) {
      const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
      await placePosition({ studentId, marketId: m.marketId, outcomeId: m.outcomes[0].id, shares: 5, payout: 250 });
    }
    const result = await computeCategoryAccuracy(studentId);
    const football = result.find((r) => r.category === 'football');
    expect(football).toBeDefined();
    expect(football.accuracy).toBeCloseTo(1.0);
  });
});

describe('computeAccuracyRank', () => {
  test('returns rank and percentile across users with 3+ calls', async () => {
    const ids = [];
    for (let u = 0; u < 3; u++) {
      const studentId = await createStudent();
      ids.push(studentId);
      const correctCount = u; // user 0 has 0 right, user 1 has 1 right, user 2 has 2 right (each across 3 markets)
      for (let i = 0; i < 3; i++) {
        const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
        const pickWinner = i < correctCount;
        await placePosition({ studentId, marketId: m.marketId, outcomeId: pickWinner ? m.outcomes[0].id : m.outcomes[1].id, shares: 5, payout: pickWinner ? 250 : 0 });
      }
    }
    const top = await computeAccuracyRank(ids[2]);
    expect(top.rank).toBe(1);
    expect(top.totalRanked).toBe(3);
    expect(top.percentile).toBeCloseTo(100);
  });

  test('correctly ranks 5 users with varying accuracies', async () => {
    const ids = [];
    const correctCounts = [3, 2, 1, 0, 2]; // 100%, 66.7%, 33.3%, 0%, 66.7%
    for (let u = 0; u < 5; u++) {
      const studentId = await createStudent();
      ids.push(studentId);
      const correctCount = correctCounts[u];
      for (let i = 0; i < 3; i++) {
        const m = await createResolvedMarket({ category: 'football', winningLabel: 'YES' });
        const pickWinner = i < correctCount;
        await placePosition({ studentId, marketId: m.marketId, outcomeId: pickWinner ? m.outcomes[0].id : m.outcomes[1].id, shares: 5, payout: pickWinner ? 250 : 0 });
      }
    }
    const rank0 = await computeAccuracyRank(ids[0]); // 100%
    expect(rank0.rank).toBe(1);
    expect(rank0.totalRanked).toBe(5);
    expect(rank0.percentile).toBeCloseTo(100);

    const rank1 = await computeAccuracyRank(ids[1]); // 66.7% (tied with ids[4])
    expect([2, 3]).toContain(rank1.rank);
    expect(rank1.totalRanked).toBe(5);

    const rank3 = await computeAccuracyRank(ids[3]); // 0%
    expect(rank3.rank).toBe(5);
    expect(rank3.totalRanked).toBe(5);
    expect(rank3.percentile).toBeCloseTo(20);
  });
});
