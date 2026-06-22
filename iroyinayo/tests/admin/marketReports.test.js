const db = require('../../src/config/database');
const { listPendingReports, updateReport } = require('../../src/modules/admin/marketReports.service');
const { randomUUID: uuidv4 } = require('crypto');

async function createMarket() {
  const id = uuidv4();
  await db('multi_markets').insert({ id, title: 'Test', status: 'open', liquidity_b: 100 });
  return id;
}

async function createStudent() {
  const id = uuidv4();
  await db('students').insert({ id, phone_number: `234${Date.now()}${Math.floor(Math.random()*10000)}`, name: 'S', is_onboarded: true, points_balance: 0 });
  return id;
}

async function createAdmin() {
  const id = uuidv4();
  await db('admins').insert({ id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'super_admin', name: 'Admin' });
  return id;
}

async function createReport(marketId, studentId, reason = 'spam') {
  const id = uuidv4();
  await db('market_reports').insert({ id, market_id: marketId, student_id: studentId, reason });
  return id;
}

describe('listPendingReports', () => {
  test('returns reports with market title and reporter name', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    await createReport(marketId, studentId, 'abusive');
    const result = await listPendingReports();
    expect(result.total).toBe(1);
    expect(result.items[0].reason).toBe('abusive');
    expect(result.items[0].market_title).toBe('Test');
    expect(result.items[0].reporter_name).toBe('S');
  });

  test('excludes resolved and dismissed reports', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId, 'r1');
    await db('market_reports').where({ id: reportId }).update({ resolution_status: 'resolved' });
    const result = await listPendingReports();
    expect(result.total).toBe(0);
  });

  test('orders newest first', async () => {
    const marketId = await createMarket();
    const studentId1 = await createStudent();
    const studentId2 = await createStudent();
    const id1 = uuidv4();
    const id2 = uuidv4();
    await db('market_reports').insert({ id: id1, market_id: marketId, student_id: studentId1, reason: 'first', created_at: new Date(Date.now() - 60000) });
    await db('market_reports').insert({ id: id2, market_id: marketId, student_id: studentId2, reason: 'second' });
    const result = await listPendingReports();
    expect(result.items[0].id).toBe(id2);
  });
});

describe('updateReport', () => {
  test('dismiss sets resolution_status to dismissed', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await updateReport(reportId, adminId, { action: 'dismiss' });
    const row = await db('market_reports').where({ id: reportId }).first();
    expect(row.resolution_status).toBe('dismissed');
    expect(row.resolved_by_admin_id).toBe(adminId);
    expect(row.resolved_at).not.toBeNull();
  });

  test('resolve sets resolution_status to resolved with note', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await updateReport(reportId, adminId, { action: 'resolve', note: 'banned creator' });
    const row = await db('market_reports').where({ id: reportId }).first();
    expect(row.resolution_status).toBe('resolved');
    expect(row.resolution_note).toBe('banned creator');
  });

  test('throws on invalid action', async () => {
    const marketId = await createMarket();
    const studentId = await createStudent();
    const reportId = await createReport(marketId, studentId);
    const adminId = await createAdmin();
    await expect(updateReport(reportId, adminId, { action: 'invalid' })).rejects.toThrow();
  });
});
