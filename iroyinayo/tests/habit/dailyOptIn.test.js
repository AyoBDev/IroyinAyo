const db = require('../../src/config/database');
const { handleDailyOptIn } = require('../../src/bot/handlers/dailyOptIn');
const crypto = require('crypto');

async function student(overrides = {}) {
  const id = crypto.randomUUID();
  await db('students').insert({
    id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'T',
    is_onboarded: true, points_balance: 1000, wa_daily_enabled: false,
    ...overrides,
  });
  return id;
}

describe('handleDailyOptIn', () => {
  test('PAUSE sets wa_paused_until 7 days ahead and is handled', async () => {
    const id = await student({ wa_daily_enabled: true });
    const phone = (await db('students').where({ id }).first()).phone_number;
    const fakeSock = { sendMessage: jest.fn() };
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'pause', sock: fakeSock });
    expect(r.handled).toBe(true);
    const s = await db('students').where({ id }).first();
    expect(s.wa_paused_until).not.toBeNull();
    expect(fakeSock.sendMessage).toHaveBeenCalled();
  });

  test('STOP disables daily and is handled', async () => {
    const id = await student({ wa_daily_enabled: true });
    const phone = (await db('students').where({ id }).first()).phone_number;
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'STOP', sock: { sendMessage: jest.fn() } });
    expect(r.handled).toBe(true);
    const s = await db('students').where({ id }).first();
    expect(s.wa_daily_enabled).toBe(false);
  });

  test('first non-command message flips wa_daily_enabled to true and is not handled', async () => {
    const id = await student();
    const phone = (await db('students').where({ id }).first()).phone_number;
    const r = await handleDailyOptIn({ phoneNumber: phone, text: 'hi', sock: { sendMessage: jest.fn() } });
    expect(r.handled).toBe(false);
    const s = await db('students').where({ id }).first();
    expect(s.wa_daily_enabled).toBe(true);
  });
});
