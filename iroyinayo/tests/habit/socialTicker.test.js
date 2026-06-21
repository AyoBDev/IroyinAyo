const { computeSocialTicker } = require('../../src/modules/habit/socialTicker');
const db = require('../../src/config/database');
const crypto = require('crypto');

describe('socialTicker', () => {
  let studentId, marketId, outcomeId1, outcomeId2;

  beforeEach(async () => {
    studentId = crypto.randomUUID();
    marketId = crypto.randomUUID();
    outcomeId1 = crypto.randomUUID();
    outcomeId2 = crypto.randomUUID();

    await db('students').insert({ id: studentId, phone_number: '+2341234567890', name: 'Test Student', points_balance: 100 });
    await db('multi_markets').insert({ id: marketId, title: 'Test Market', status: 'open', liquidity_b: 50 });
    await db('multi_market_outcomes').insert([
      { id: outcomeId1, market_id: marketId, label: 'Yes', shares_sold: 0 },
      { id: outcomeId2, market_id: marketId, label: 'No', shares_sold: 0 },
    ]);
  });

  afterEach(async () => {
    await db('multi_market_positions').where({ student_id: studentId }).del();
    await db('multi_market_outcomes').where({ market_id: marketId }).del();
    await db('multi_markets').where({ id: marketId }).del();
    await db('students').where({ id: studentId }).del();
  });

  test('returns "alone" when no other holders on this outcome', async () => {
    const result = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId: outcomeId1,
      totalPredictionsAfter: 1,
    });
    expect(result).toEqual({ type: 'alone', copy: "You're alone on this." });
  });

  test('returns "peer_opposite" when a peer took the opposite side recently', async () => {
    const peerId = crypto.randomUUID();
    await db('students').insert({ id: peerId, phone_number: '+2349876543210', name: 'Peer Student', points_balance: 100 });

    const lookbackTime = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const recentTime = new Date(Date.now() - 30 * 60 * 1000);

    await db('multi_market_positions').insert([
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId1, student_id: studentId, amount: 10, shares: 10, entry_price: 0.5, created_at: lookbackTime },
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId1, student_id: peerId, amount: 10, shares: 10, entry_price: 0.5, created_at: lookbackTime },
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId2, student_id: peerId, amount: 10, shares: 10, entry_price: 0.5, created_at: recentTime },
    ]);

    const result = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId: outcomeId1,
      totalPredictionsAfter: 4,
    });

    expect(result.type).toBe('peer_opposite');
    expect(result.copy).toContain('Peer Student');
    expect(result.copy).toContain('called the opposite');

    await db('multi_market_positions').where({ student_id: peerId }).del();
    await db('students').where({ id: peerId }).del();
  });

  test('returns "milestone" when total predictions hits a milestone', async () => {
    const otherId = crypto.randomUUID();
    await db('students').insert({ id: otherId, phone_number: '+2349999999999', name: 'Other Student', points_balance: 100 });
    await db('multi_market_positions').insert([
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId1, student_id: otherId, amount: 10, shares: 10, entry_price: 0.5 },
    ]);

    const result = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId: outcomeId1,
      totalPredictionsAfter: 100,
    });

    expect(result).toEqual({ type: 'milestone', copy: "You're prediction #100 on this market." });

    await db('multi_market_positions').where({ student_id: otherId }).del();
    await db('students').where({ id: otherId }).del();
  });

  test('returns null when no conditions match', async () => {
    const otherId = crypto.randomUUID();
    await db('students').insert({ id: otherId, phone_number: '+2349999999999', name: 'Other Student', points_balance: 100 });
    await db('multi_market_positions').insert([
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId1, student_id: otherId, amount: 10, shares: 10, entry_price: 0.5 },
    ]);

    const result = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId: outcomeId1,
      totalPredictionsAfter: 99,
    });

    expect(result).toBeNull();

    await db('multi_market_positions').where({ student_id: otherId }).del();
    await db('students').where({ id: otherId }).del();
  });

  test('does not crash when student has zero prior positions', async () => {
    const otherId = crypto.randomUUID();
    await db('students').insert({ id: otherId, phone_number: '+2349999999999', name: 'Other Student', points_balance: 100 });
    await db('multi_market_positions').insert([
      { id: crypto.randomUUID(), market_id: marketId, outcome_id: outcomeId1, student_id: otherId, amount: 10, shares: 10, entry_price: 0.5 },
    ]);

    const result = await computeSocialTicker({
      studentId,
      marketId,
      outcomeId: outcomeId1,
      totalPredictionsAfter: 50,
    });

    expect(result).toBeNull();

    await db('multi_market_positions').where({ student_id: otherId }).del();
    await db('students').where({ id: otherId }).del();
  });
});
