const request = require('supertest');
const { generateKeyPair, signTestJwt } = require('../auth/testJwks');

let mockedPublicKey;
jest.mock('jose', () => {
  const actual = jest.requireActual('jose');
  return {
    ...actual,
    createRemoteJWKSet: jest.fn(() => async () => mockedPublicKey),
  };
});

jest.mock('../../src/modules/refills/refill.service', () => ({
  getPending: jest.fn(),
  claim: jest.fn(),
  getMondayInWAT: jest.fn(() => '2026-06-22'),
  issuePendingRefills: jest.fn(),
}));

jest.mock('../../src/config/database', () => {
  const fn = jest.fn();
  return fn;
});

const db = require('../../src/config/database');
const { getPending } = require('../../src/modules/refills/refill.service');
const app = require('../../src/app');

let privateKey;

beforeAll(async () => {
  process.env.SUPABASE_JWKS_URL = 'https://test.supabase.co/auth/v1/.well-known/jwks.json';
  process.env.SUPABASE_JWT_ISSUER = 'https://test.supabase.co/auth/v1';
  const kp = await generateKeyPair();
  privateKey = kp.privateKey;
  mockedPublicKey = kp.publicKey;
});

beforeEach(() => {
  getPending.mockReset();
  db.mockImplementation(() => ({
    where: () => ({ first: async () => ({ id: 'student-1', auth_user_id: 'user-1', is_banned: false }) }),
  }));
});

test('returns pending refill when one exists', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  getPending.mockResolvedValue({ pending: { id: 'p1', amount: 80 }, refillsRemaining: 2 });

  const res = await request(app)
    .get('/api/me/pending-refill')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ pending: { id: 'p1', amount: 80 }, refillsRemaining: 2 });
  expect(getPending).toHaveBeenCalledWith({ studentId: 'student-1' });
});

test('returns null when no pending refill', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  getPending.mockResolvedValue({ pending: null, refillsRemaining: 3 });

  const res = await request(app)
    .get('/api/me/pending-refill')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ pending: null, refillsRemaining: 3 });
});

test('missing Authorization returns 401', async () => {
  const res = await request(app).get('/api/me/pending-refill');
  expect(res.status).toBe(401);
  expect(getPending).not.toHaveBeenCalled();
});
