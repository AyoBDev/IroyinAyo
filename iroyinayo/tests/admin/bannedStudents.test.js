const db = require('../../src/config/database');
const { listRecentBans } = require('../../src/modules/admin/bannedStudents.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createBannedStudent({ name = 'Banned', ago = 0 } = {}) {
  const id = uuidv4();
  await db('students').insert({
    id,
    phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`,
    name,
    is_onboarded: true,
    is_banned: true,
    points_balance: 0,
  });
  // If a banned_at column exists, set it; otherwise rely on updated_at default
  const hasBannedAt = await db.raw(
    `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='banned_at'`
  );
  if (hasBannedAt.rows.length > 0 && ago > 0) {
    const t = new Date(Date.now() - ago * 24 * 60 * 60 * 1000);
    await db('students').where({ id }).update({ banned_at: t });
  }
  return id;
}

describe('listRecentBans', () => {
  test('returns banned students', async () => {
    await createBannedStudent({ name: 'Recent ban' });
    const result = await listRecentBans();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items.some((i) => i.name === 'Recent ban')).toBe(true);
  });

  test('excludes non-banned students', async () => {
    const id = uuidv4();
    await db('students').insert({
      id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'Active', is_onboarded: true, is_banned: false, points_balance: 0,
    });
    const result = await listRecentBans();
    expect(result.items.some((i) => i.id === id)).toBe(false);
  });
});
