// We don't actually want to trigger a real Baileys reconnect in tests.
// This test verifies the route's return shape via mocking.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/config/database');
const { randomUUID: uuidv4 } = require('crypto');

async function adminToken() {
  const id = uuidv4();
  await db('admins').insert({
    id, email: `a-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'super_admin', name: 'Test Admin',
  });
  return jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret');
}

describe('POST /api/admin/bot/reconnect', () => {
  test('requires auth', async () => {
    const res = await request(app).post('/api/admin/bot/reconnect');
    expect(res.status).toBe(401);
  });

  test('returns a status string when authed', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/admin/bot/reconnect').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(['reconnecting', 'already_connected', 'failed']).toContain(res.body.status);
    expect(typeof res.body.message).toBe('string');
  });
});
