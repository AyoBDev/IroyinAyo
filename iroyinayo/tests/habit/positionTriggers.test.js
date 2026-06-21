const db = require('../../src/config/database');
const { evaluatePositionTriggers, fireResolvedAwayNotifications } = require('../../src/modules/habit/positionTriggers');
const crypto = require('crypto');

async function setup({ marketStatus = 'open', closesAt = null, resolvedAt = null, payout = 0, lastOpen = null } = {}) {
  const studentId = crypto.randomUUID();
  await db('students').insert({
    id: studentId,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'T', is_onboarded: true, points_balance: 1000,
    last_app_open_at: lastOpen,
    wa_daily_enabled: true,
    is_system: false,
  });
  const marketId = crypto.randomUUID();
  await db('multi_markets').insert({ id: marketId, title: 'T', status: marketStatus, closes_at: closesAt, resolved_at: resolvedAt, liquidity_b: 100 });
  const outcomeId = crypto.randomUUID();
  await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0 });
  const positionId = crypto.randomUUID();
  await db('multi_market_positions').insert({ id: positionId, student_id: studentId, market_id: marketId, outcome_id: outcomeId, shares: 5, amount: 250, payout });
  return { studentId, marketId, positionId, outcomeId };
}

describe('evaluatePositionTriggers', () => {
  test('writes resolution_today row when market closes in next 24h', async () => {
    const { positionId } = await setup({ closesAt: new Date(Date.now() + 6 * 60 * 60 * 1000) });
    const r = await evaluatePositionTriggers();
    expect(r.resolutionToday).toBe(1);
    const trig = await db('position_triggers').where({ position_id: positionId, condition: 'resolution_today' }).first();
    expect(trig).toBeDefined();
  });

  test('writes resolved_away row when market just resolved and user away', async () => {
    const resolved = new Date(Date.now() - 30 * 60 * 1000);
    const stale = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const { positionId } = await setup({ marketStatus: 'resolved', resolvedAt: resolved, lastOpen: stale });
    const r = await evaluatePositionTriggers();
    expect(r.resolvedAway).toBe(1);
    const trig = await db('position_triggers').where({ position_id: positionId, condition: 'resolved_away' }).first();
    expect(trig).toBeDefined();
  });

  test('idempotent — second call does not duplicate rows', async () => {
    await setup({ closesAt: new Date(Date.now() + 6 * 60 * 60 * 1000) });
    await evaluatePositionTriggers();
    await evaluatePositionTriggers();
    const rows = await db('position_triggers').where({ condition: 'resolution_today' });
    expect(rows.length).toBe(1);
  });

  test('resolution_today does NOT fire for system account', async () => {
    const studentId = crypto.randomUUID();
    await db('students').insert({
      id: studentId,
      phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
      name: 'T', is_onboarded: true, points_balance: 1000,
      is_system: true,
      wa_daily_enabled: true,
    });
    const marketId = crypto.randomUUID();
    await db('multi_markets').insert({ id: marketId, title: 'T', status: 'open', closes_at: new Date(Date.now() + 6 * 60 * 60 * 1000), liquidity_b: 100 });
    const outcomeId = crypto.randomUUID();
    await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0 });
    const positionId = crypto.randomUUID();
    await db('multi_market_positions').insert({ id: positionId, student_id: studentId, market_id: marketId, outcome_id: outcomeId, shares: 5, amount: 250 });

    const r = await evaluatePositionTriggers();
    expect(r.resolutionToday).toBe(0);
  });

  test('resolved_away does NOT fire for banned user', async () => {
    const studentId = crypto.randomUUID();
    await db('students').insert({
      id: studentId,
      phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
      name: 'T', is_onboarded: true, points_balance: 1000,
      is_banned: true,
      last_app_open_at: new Date(Date.now() - 13 * 60 * 60 * 1000),
      wa_daily_enabled: true,
      is_system: false,
    });
    const marketId = crypto.randomUUID();
    const resolved = new Date(Date.now() - 30 * 60 * 1000);
    await db('multi_markets').insert({ id: marketId, title: 'T', status: 'resolved', resolved_at: resolved, liquidity_b: 100 });
    const outcomeId = crypto.randomUUID();
    await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0 });
    const positionId = crypto.randomUUID();
    await db('multi_market_positions').insert({ id: positionId, student_id: studentId, market_id: marketId, outcome_id: outcomeId, shares: 5, amount: 250, payout: 0 });

    const r = await evaluatePositionTriggers();
    expect(r.resolvedAway).toBe(0);
  });
});
