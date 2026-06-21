const db = require('../../src/config/database');
const { drainDailyQueue } = require('../../src/modules/habit/queueSender');
const notifications = require('../../src/modules/notifications/whatsapp');
const crypto = require('crypto');

async function enroll(overrides = {}) {
  const id = crypto.randomUUID();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'T',
    is_onboarded: true,
    wa_daily_enabled: true,
    wa_anchor_time: '08:00:00',
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

async function enqueue(studentId, scheduledFor = new Date()) {
  const id = crypto.randomUUID();
  await db('whatsapp_daily_queue').insert({
    id,
    student_id: studentId,
    scheduled_for: scheduledFor,
    lede_type: 'curiosity',
    lede_payload: { marketId: 'mkt', marketTitle: 'X?' },
    markets: JSON.stringify([{ market_id: 'mkt', label: 'X', resolves_in_minutes: 60 }]),
    status: 'pending',
  });
  return id;
}

describe('drainDailyQueue', () => {
  test('sends pending rows and marks them sent', async () => {
    const s = await enroll();
    await enqueue(s);
    const sendFn = jest.fn(async () => true);
    const sleepFn = jest.fn(async () => {});
    const result = await drainDailyQueue({ sendFn, sleepFn });
    expect(result.sent).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
    const row = await db('whatsapp_daily_queue').first();
    expect(row.status).toBe('sent');
    expect(row.sent_at).not.toBeNull();
  });

  test('skips rows for users active within 4h', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    const s = await enroll({ last_app_open_at: recent });
    await enqueue(s);
    const sendFn = jest.fn(async () => true);
    const result = await drainDailyQueue({ sendFn, sleepFn: async () => {} });
    expect(result.skipped).toBe(1);
    expect(sendFn).not.toHaveBeenCalled();
    const row = await db('whatsapp_daily_queue').first();
    expect(row.status).toBe('skipped');
  });

  test('paces sends with sleep between messages', async () => {
    const s1 = await enroll();
    const s2 = await enroll();
    await enqueue(s1);
    await enqueue(s2);
    const sleepFn = jest.fn(async () => {});
    await drainDailyQueue({ sendFn: async () => true, sleepFn });
    expect(sleepFn).toHaveBeenCalled();
  });

  test('pauses student after 2 consecutive failures', async () => {
    const s = await enroll({ wa_failure_count: 1 });
    await enqueue(s);
    const orig = notifications.sendWhatsApp;
    notifications.sendWhatsApp = async () => false;
    try {
      await drainDailyQueue({ sleepFn: async () => {} });
    } finally {
      notifications.sendWhatsApp = orig;
    }
    const student = await db('students').where({ id: s }).first();
    expect(student.wa_failure_count).toBeGreaterThanOrEqual(2);
    expect(student.wa_paused_until).not.toBeNull();
  });

  test('halts entire run when failure rate exceeds 5% in window', async () => {
    for (let i = 0; i < 25; i++) {
      const sid = await enroll();
      await enqueue(sid);
    }
    let i = 0;
    const sendFn = async () => { i += 1; return i > 5; }; // first 5 fail, 20% fail rate triggers halt
    const result = await drainDailyQueue({ sendFn, sleepFn: async () => {} });
    expect(result.sent + result.failed).toBeLessThan(25);
  });
});
