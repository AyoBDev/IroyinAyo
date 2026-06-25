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
    email: `t-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.local`,
    name: 'T',
    is_onboarded: true,
    points_balance: 1000,
    is_banned: false,
  });
  const token = await signTestJwt({ privateKey, sub: authUserId, email: 't@test.local' });
  return { id, authUserId, token };
}

async function makeMarket() {
  const marketId = crypto.randomUUID();
  await db('multi_markets').insert({
    id: marketId,
    title: 'sourceRef test market',
    status: 'open',
    liquidity_b: 100,
    closes_at: new Date(Date.now() + 3600000),
  });
  const outcomeId = crypto.randomUUID();
  await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0 });
  await db('multi_market_outcomes').insert({ id: crypto.randomUUID(), market_id: marketId, label: 'NO', shares_sold: 0 });
  return { marketId, outcomeId };
}

describe('POST /api/multi-markets/:id/predict — sourceRef validation', () => {
  test('accepts an allow-listed sourceRef and persists it', async () => {
    const { id: studentId, token } = await makeUserWithToken();
    const { marketId, outcomeId } = await makeMarket();
    const res = await request(app)
      .post(`/api/multi-markets/${marketId}/predict`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcomeId, amount: 5, sourceRef: 'wa_daily:rank' });
    expect(res.status).toBe(200);
    const pos = await db('multi_market_positions').where({ student_id: studentId, market_id: marketId }).first();
    expect(pos.source_ref).toBe('wa_daily:rank');
  });

  test('rejects garbage sourceRef by storing null', async () => {
    const { id: studentId, token } = await makeUserWithToken();
    const { marketId, outcomeId } = await makeMarket();
    const res = await request(app)
      .post(`/api/multi-markets/${marketId}/predict`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcomeId, amount: 5, sourceRef: 'evil; drop table--' });
    expect(res.status).toBe(200);
    const pos = await db('multi_market_positions').where({ student_id: studentId, market_id: marketId }).first();
    expect(pos.source_ref).toBeNull();
  });
});
