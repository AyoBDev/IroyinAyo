const db = require('../../src/config/database');
const { getWeeklyWinnerStatus, markWinnerPaid } = require('../../src/modules/admin/weeklyWinner.service');
const { randomUUID: uuidv4 } = require('crypto');

function getCurrentWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({ id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', name: 'Admin', role: 'super_admin' });
  return id;
}

async function createWinnerRow({ paid = false } = {}) {
  const id = uuidv4();
  const weekStart = getCurrentWeekStart();
  const winnerId = uuidv4();
  await db('students').insert({ id: winnerId, phone_number: `234${Date.now()}${Math.floor(Math.random()*10000)}`, name: 'Winner', is_onboarded: true, points_balance: 100 });
  await db('weekly_leaderboards').insert({
    id,
    week_start: weekStart,
    week_end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
    winner_id: winnerId,
    winner_name: 'Winner',
    winner_profit: 500,
    prize_paid: paid,
  });
  return { id, weekStart, winnerId };
}

describe('getWeeklyWinnerStatus', () => {
  test('returns winner data when row exists', async () => {
    await createWinnerRow();
    const result = await getWeeklyWinnerStatus();
    expect(result).not.toBeNull();
    expect(result.winnerName).toBe('Winner');
    expect(result.winnerProfit).toBe(500);
    expect(result.prizePaid).toBe(false);
  });

  test('returns null when no row for current week', async () => {
    const result = await getWeeklyWinnerStatus();
    expect(result).toBeNull();
  });
});

describe('markWinnerPaid', () => {
  test('flips prize_paid to true and records metadata', async () => {
    const { weekStart } = await createWinnerRow();
    const adminId = await createAdmin();
    await markWinnerPaid(weekStart, adminId);
    const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
    expect(row.prize_paid).toBe(true);
    expect(row.paid_by_admin_id).toBe(adminId);
    expect(row.paid_at).not.toBeNull();
  });

  test('throws if already paid', async () => {
    const { weekStart } = await createWinnerRow({ paid: true });
    const adminId = await createAdmin();
    await expect(markWinnerPaid(weekStart, adminId)).rejects.toThrow(/already paid/i);
  });

  test('throws if no row for week', async () => {
    const adminId = await createAdmin();
    await expect(markWinnerPaid(new Date('2020-01-01'), adminId)).rejects.toThrow(/not found/i);
  });
});
