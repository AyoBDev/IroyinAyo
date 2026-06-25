const request = require('supertest');
const crypto = require('crypto');
const db = require('../../src/config/database');
const { generateKeyPair, signTestJwt } = require('../auth/testJwks');

let mockedPublicKey;
let privateKey;

// Mock jose so the middleware's createRemoteJWKSet uses our local key.
jest.mock('jose', () => {
  const actual = jest.requireActual('jose');
  return {
    ...actual,
    createRemoteJWKSet: jest.fn(() => async () => mockedPublicKey),
  };
});

// IMPORTANT: app must be required AFTER jest.mock('jose') so its module
// graph picks up the mocked createRemoteJWKSet.
const app = require('../../src/app');

beforeAll(async () => {
  process.env.SUPABASE_JWKS_URL = 'https://test.supabase.co/auth/v1/.well-known/jwks.json';
  process.env.SUPABASE_JWT_ISSUER = 'https://test.supabase.co/auth/v1';
  const kp = await generateKeyPair();
  privateKey = kp.privateKey;
  mockedPublicKey = kp.publicKey;
});

async function makeUserWithToken() {
  const id = crypto.randomUUID();
  const authUserId = crypto.randomUUID();
  await db('students').insert({
    id,
    auth_user_id: authUserId,
    email: `t-${Date.now()}-${Math.floor(Math.random()*100000)}@test.local`,
    name: 'T',
    is_onboarded: true,
    points_balance: 1000,
    is_banned: false,
  });
  const token = await signTestJwt({ privateKey, sub: authUserId, email: 't@test.local' });
  return { id, authUserId, token };
}

describe('GET /api/habit/accuracy/:userId', () => {
  test('returns null accuracy for new users with no resolved calls', async () => {
    const { id } = await makeUserWithToken();
    const res = await request(app).get(`/api/habit/accuracy/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.allTime.accuracy).toBeNull();
    expect(res.body.allTime.resolvedCalls).toBe(0);
  });
});

describe('GET /api/habit/triggers/in-app-strip', () => {
  test('requires auth', async () => {
    const res = await request(app).get('/api/habit/triggers/in-app-strip');
    expect(res.status).toBe(401);
  });

  test('returns empty list when user has no open positions', async () => {
    const { token } = await makeUserWithToken();
    const res = await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sharpMoves).toEqual([]);
  });

  test('updates last_app_open_at on authenticated request', async () => {
    const { id, token } = await makeUserWithToken();
    await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    await new Promise(r => setTimeout(r, 50));
    const student = await db('students').where({ id }).first();
    expect(student.last_app_open_at).toBeTruthy();
    expect(new Date(student.last_app_open_at).getTime()).toBeGreaterThan(Date.now() - 10000);
  });

  test('throttles back-to-back last_app_open_at writes', async () => {
    const { id, token } = await makeUserWithToken();
    await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    await new Promise(r => setTimeout(r, 50));
    const student1 = await db('students').where({ id }).first();
    const first = student1.last_app_open_at;
    await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    await new Promise(r => setTimeout(r, 50));
    const student2 = await db('students').where({ id }).first();
    expect(student2.last_app_open_at).toEqual(first);
  });

  test('detects sharp move with earliest and latest snapshots', async () => {
    const { id, token } = await makeUserWithToken();
    const marketId = crypto.randomUUID();
    await db('multi_markets').insert({ id: marketId, title: 'Will X?', closes_at: new Date(Date.now() + 1000*60*60), status: 'open' });
    const outcomeId = crypto.randomUUID();
    await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'Yes' });
    await db('multi_market_positions').insert({ student_id: id, market_id: marketId, outcome_id: outcomeId, shares: 10, amount: 100 });
    const snap1 = { market_id: marketId, captured_at: new Date(Date.now() - 30*60*1000), prices: JSON.stringify([{ outcome_id: outcomeId, price: 0.40 }]) };
    const snap2 = { market_id: marketId, captured_at: new Date(Date.now() - 5*60*1000), prices: JSON.stringify([{ outcome_id: outcomeId, price: 0.55 }]) };
    await db('market_price_snapshots').insert([snap1, snap2]);
    const res = await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sharpMoves).toHaveLength(1);
    expect(res.body.sharpMoves[0].marketId).toBe(marketId);
    expect(res.body.sharpMoves[0].deltaPp).toBe(15);
  });

  test('returns empty when only one snapshot exists', async () => {
    const { id, token } = await makeUserWithToken();
    const marketId = crypto.randomUUID();
    await db('multi_markets').insert({ id: marketId, title: 'Will Y?', closes_at: new Date(Date.now() + 1000*60*60), status: 'open' });
    const outcomeId = crypto.randomUUID();
    await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'Yes' });
    await db('multi_market_positions').insert({ student_id: id, market_id: marketId, outcome_id: outcomeId, shares: 10, amount: 100 });
    await db('market_price_snapshots').insert({ market_id: marketId, captured_at: new Date(Date.now() - 5*60*1000), prices: JSON.stringify([{ outcome_id: outcomeId, price: 0.40 }]) });
    const res = await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sharpMoves).toEqual([]);
  });
});

describe('POST /api/habit/opt-in', () => {
  test('requires auth', async () => {
    const res = await request(app).post('/api/habit/opt-in');
    expect(res.status).toBe(401);
  });

  test('sets wa_daily_enabled to true', async () => {
    const { id, token } = await makeUserWithToken();
    const res = await request(app).post('/api/habit/opt-in').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const student = await db('students').where({ id }).first();
    expect(student.wa_daily_enabled).toBe(true);
  });
});
