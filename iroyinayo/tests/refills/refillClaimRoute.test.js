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
  getMondayInWAT: jest.fn(),
  issuePendingRefills: jest.fn(),
}));

jest.mock('../../src/config/database', () => {
  const fn = jest.fn();
  return fn;
});

const db = require('../../src/config/database');
const { claim } = require('../../src/modules/refills/refill.service');
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
  claim.mockReset();
  db.mockImplementation(() => ({
    where: () => ({ first: async () => ({ id: 'student-1', auth_user_id: 'user-1', is_banned: false }) }),
  }));
});

test('successful claim returns 200', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  claim.mockResolvedValue({ ok: true, amount: 80, newBalance: 80 });

  const res = await request(app)
    .post('/api/me/pending-refill/claim')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: 'p1' });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true, amount: 80, newBalance: 80 });
  expect(claim).toHaveBeenCalledWith({ studentId: 'student-1', refillId: 'p1' });
});

test('ALREADY_CLAIMED returns 400 with code', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  claim.mockResolvedValue({ ok: false, code: 'ALREADY_CLAIMED' });

  const res = await request(app)
    .post('/api/me/pending-refill/claim')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: 'p1' });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ code: 'ALREADY_CLAIMED' });
});

test('WEEKLY_CAP_REACHED returns 400 with code', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  claim.mockResolvedValue({ ok: false, code: 'WEEKLY_CAP_REACHED' });

  const res = await request(app)
    .post('/api/me/pending-refill/claim')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: 'p1' });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ code: 'WEEKLY_CAP_REACHED' });
});

test('missing Authorization returns 401', async () => {
  const res = await request(app)
    .post('/api/me/pending-refill/claim')
    .send({ id: 'p1' });

  expect(res.status).toBe(401);
  expect(claim).not.toHaveBeenCalled();
});
