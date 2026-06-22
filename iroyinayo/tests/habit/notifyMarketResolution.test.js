const db = require('../../src/config/database');
const notifications = require('../../src/modules/notifications/whatsapp');
const botSocket = require('../../src/bot/botSocket');
const crypto = require('crypto');

async function createStudent(overrides = {}) {
  const id = crypto.randomUUID();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'Test',
    is_onboarded: true,
    points_balance: 1000,
    is_system: false,
    is_banned: false,
    ...overrides,
  });
  return id;
}

async function createMarketWithPosition({ studentId, payout = 0 } = {}) {
  const marketId = crypto.randomUUID();
  await db('multi_markets').insert({
    id: marketId,
    title: 'Test Market',
    status: 'resolved',
    liquidity_b: 100,
    resolved_at: new Date(),
  });
  const outcomeId = crypto.randomUUID();
  await db('multi_market_outcomes').insert({
    id: outcomeId,
    market_id: marketId,
    label: 'YES',
    shares_sold: 5,
  });
  await db('multi_market_positions').insert({
    id: crypto.randomUUID(),
    student_id: studentId,
    market_id: marketId,
    outcome_id: outcomeId,
    shares: 5,
    amount: 50,
    payout,
    entry_price: 0.5,
  });
  return { marketId, outcomeId };
}

describe('notifyMarketResolution', () => {
  let sock;

  beforeEach(() => {
    sock = { sendMessage: jest.fn().mockResolvedValue(true) };
    botSocket.setBotSocket(sock);
  });

  afterEach(() => {
    botSocket.setBotSocket(null);
  });

  test('only messages holders active within the last 12h', async () => {
    const idleStudent = await createStudent({ last_app_open_at: new Date(Date.now() - 13 * 60 * 60 * 1000) });
    const activeStudent = await createStudent({ last_app_open_at: new Date(Date.now() - 1 * 60 * 60 * 1000) });
    const { marketId, outcomeId } = await createMarketWithPosition({ studentId: idleStudent, payout: 0 });
    await db('multi_market_positions').insert({
      id: crypto.randomUUID(),
      student_id: activeStudent,
      market_id: marketId,
      outcome_id: outcomeId,
      shares: 3,
      amount: 30,
      payout: 0,
      entry_price: 0.5,
    });

    await notifications.notifyMarketResolution(marketId, 'YES');

    const idle = await db('students').where({ id: idleStudent }).first();
    const active = await db('students').where({ id: activeStudent }).first();
    const jidsSent = sock.sendMessage.mock.calls.map(([jid]) => jid);
    expect(jidsSent).toContain(`${active.phone_number}@s.whatsapp.net`);
    expect(jidsSent).not.toContain(`${idle.phone_number}@s.whatsapp.net`);
  });

  test('skips holders with null last_app_open_at (idle bucket)', async () => {
    const neverOpen = await createStudent({ last_app_open_at: null });
    const { marketId } = await createMarketWithPosition({ studentId: neverOpen, payout: 0 });

    await notifications.notifyMarketResolution(marketId, 'YES');

    expect(sock.sendMessage).not.toHaveBeenCalled();
  });
});
