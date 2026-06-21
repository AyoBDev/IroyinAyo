const db = require('../../src/config/database');
const notifications = require('../../src/modules/notifications/whatsapp');
const crypto = require('crypto');

async function createStudent(overrides = {}) {
  const id = crypto.randomUUID();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`,
    name: 'Test Student',
    is_onboarded: true,
    wa_daily_enabled: true,
    wa_anchor_time: '08:00:00',
    points_balance: 1000,
    ...overrides,
  });
  return id;
}

describe('sendWhatsAppWithFailureTracking', () => {
  test('resets wa_failure_count to 0 on success when count was non-zero', async () => {
    const studentId = await createStudent({ wa_failure_count: 3 });
    let student = await db('students').where({ id: studentId }).first();

    const spy = jest.spyOn(notifications, 'sendWhatsApp').mockResolvedValue(true);
    await notifications.sendWhatsAppWithFailureTracking(student, 'Test message');
    spy.mockRestore();

    student = await db('students').where({ id: studentId }).first();
    expect(student.wa_failure_count).toBe(0);
  });

  test('increments wa_failure_count and sets wa_paused_until at 2 failures', async () => {
    const studentId = await createStudent({ wa_failure_count: 1 });
    let student = await db('students').where({ id: studentId }).first();

    const spy = jest.spyOn(notifications, 'sendWhatsApp').mockResolvedValue(false);
    await notifications.sendWhatsAppWithFailureTracking(student, 'Test message');
    spy.mockRestore();

    student = await db('students').where({ id: studentId }).first();
    expect(student.wa_failure_count).toBe(2);
    expect(student.wa_paused_until).not.toBeNull();

    const pauseDate = new Date(student.wa_paused_until);
    const now = new Date();
    const daysDiff = (pauseDate - now) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(13);
    expect(daysDiff).toBeLessThan(15);
  });
});
