const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/config/database');
const { randomUUID: uuidv4 } = require('crypto');

beforeEach(async () => {
  const house = await db('students').where({ is_system: true }).first();
  if (!house) {
    await db('students').insert({
      id: uuidv4(),
      name: 'IroyinMarket',
      phone_number: 'system',
      is_system: true,
      points_balance: 999999,
      is_onboarded: true,
      is_banned: false,
    });
  }
});

async function adminToken(role = 'super_admin') {
  const id = uuidv4();
  await db('admins').insert({
    id, email: `cm-${id.slice(0, 8)}@t.com`, password_hash: 'x', role, name: 'T',
  });
  return { token: jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret'), id };
}

function basePayload(overrides = {}) {
  return {
    title: 'Will UNILAG beat OAU on Saturday?',
    outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
    category: 'sports',
    ...overrides,
  };
}

describe('POST /api/multi-markets/admin/create — description & closesAt', () => {
  test('persists description and closes_at when provided', async () => {
    const { token } = await adminToken();
    const closesAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const description = 'Resolves to the winner of the UNILAG vs OAU football match on Saturday.';
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ description, closesAt }));
    expect(res.status).toBe(200);
    const row = await db('multi_markets').where({ id: res.body.id }).first();
    expect(row.description).toBe(description);
    expect(new Date(row.closes_at).toISOString()).toBe(closesAt);
  });

  test('400 when closesAt is in the past', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ closesAt: new Date(Date.now() - 86_400_000).toISOString() }));
    expect(res.status).toBe(400);
  });

  test('400 when closesAt is not a parseable date', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ closesAt: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  test('400 when description is longer than 500 chars', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ description: 'a'.repeat(501) }));
    expect(res.status).toBe(400);
  });

  test('400 when description is an empty string', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ description: '   ' }));
    expect(res.status).toBe(400);
  });

  test('backwards compat: still creates a market when description and closesAt are omitted', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload());
    expect(res.status).toBe(200);
    const row = await db('multi_markets').where({ id: res.body.id }).first();
    expect(row.title).toBe(basePayload().title);
    expect(row.description).toBeFalsy();
  });

  test('persists a custom category from the manual form', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/multi-markets/admin/create')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload({ category: 'campus_news_special' }));
    expect(res.status).toBe(200);
    const row = await db('multi_markets').where({ id: res.body.id }).first();
    expect(row.category).toBe('campus_news_special');
  });
});
