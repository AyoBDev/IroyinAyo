const db = require('../../src/config/database');
const { getSummary, getHealth } = require('../../src/modules/admin/controlCenter.service');
const { randomUUID: uuidv4 } = require('crypto');

describe('getSummary', () => {
  test('returns zero counts when DB is empty', async () => {
    const result = await getSummary();
    expect(result.marketsToResolve).toBe(0);
    expect(result.pendingUserMarkets).toBe(0);
    expect(result.simulationAlerts).toBe(0);
    expect(result.marketReports).toBe(0);
    expect(result.weeklyWinnerUnpaid).toBe(false);
    expect(result.totalsManageStrip).toBeDefined();
  });

  test('counts closed markets needing resolution', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'resolved', liquidity_b: 100 });
    const result = await getSummary();
    expect(result.marketsToResolve).toBe(2);
  });

  test('counts pending user-created markets', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'pending', liquidity_b: 100 });
    const result = await getSummary();
    expect(result.pendingUserMarkets).toBe(1);
  });

  test('counts pending market reports', async () => {
    const marketId = uuidv4();
    await db('multi_markets').insert({ id: marketId, title: 't', status: 'open', liquidity_b: 100 });
    const studentId = uuidv4();
    await db('students').insert({ id: studentId, phone_number: `234${Date.now()}`, name: 'S', is_onboarded: true, points_balance: 0 });
    await db('market_reports').insert({ id: uuidv4(), market_id: marketId, student_id: studentId, reason: 'r' });
    const result = await getSummary();
    expect(result.marketReports).toBe(1);
  });
});

describe('getHealth', () => {
  test('returns zero queue counts and zero triggers when DB empty', async () => {
    const result = await getHealth();
    expect(result.todayQueue).toEqual({ sent: 0, failed: 0, skipped: 0, pending: 0 });
    expect(result.openMarketsCount).toBe(0);
    expect(result.pendingPositionTriggers).toBe(0);
  });

  test('counts open markets', async () => {
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'open', liquidity_b: 100 });
    await db('multi_markets').insert({ id: uuidv4(), title: 't', status: 'closed', liquidity_b: 100 });
    const result = await getHealth();
    expect(result.openMarketsCount).toBe(1);
  });

  test('counts today\'s queue statuses', async () => {
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const studentId = uuidv4();
    await db('students').insert({ id: studentId, phone_number: `234${Date.now()}`, name: 'S', is_onboarded: true, points_balance: 0 });
    await db('whatsapp_daily_queue').insert({
      id: uuidv4(), student_id: studentId, scheduled_for: today, status: 'sent', markets: '[]',
    });
    await db('whatsapp_daily_queue').insert({
      id: uuidv4(), student_id: studentId, scheduled_for: today, status: 'failed', markets: '[]',
    });
    const result = await getHealth();
    expect(result.todayQueue.sent).toBe(1);
    expect(result.todayQueue.failed).toBe(1);
  });
});
