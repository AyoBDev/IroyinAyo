const request = require('supertest');
const { generateKeyPair, signTestJwt } = require('./testJwks');

let mockedPublicKey;
jest.mock('jose', () => {
  const actual = jest.requireActual('jose');
  return {
    ...actual,
    createRemoteJWKSet: jest.fn(() => async () => mockedPublicKey),
  };
});

jest.mock('../../src/modules/auth/pin.service', () => ({
  setPin: jest.fn(),
  verifyPin: jest.fn(),
}));

const { verifyPin } = require('../../src/modules/auth/pin.service');
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
  verifyPin.mockReset();
});

test('correct pin returns 200', async () => {
  verifyPin.mockResolvedValue({ ok: true });
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/verify-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: '123456' });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
  expect(verifyPin).toHaveBeenCalledWith({ authUserId: 'user-1', pin: '123456' });
});

test('wrong pin returns 401 PIN_INVALID with attempts_remaining', async () => {
  verifyPin.mockResolvedValue({ ok: false, code: 'PIN_INVALID', attemptsRemaining: 2 });
  const token = await signTestJwt({ privateKey, sub: 'user-2', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/verify-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: '999999' });

  expect(res.status).toBe(401);
  expect(res.body).toEqual({ code: 'PIN_INVALID', attempts_remaining: 2 });
});

test('locked pin returns 401 PIN_LOCKED', async () => {
  verifyPin.mockResolvedValue({ ok: false, code: 'PIN_LOCKED' });
  const token = await signTestJwt({ privateKey, sub: 'user-3', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/verify-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: '999999' });

  expect(res.status).toBe(401);
  expect(res.body).toEqual({ code: 'PIN_LOCKED' });
});

test('no pin set returns 401 NO_PIN', async () => {
  verifyPin.mockResolvedValue({ ok: false, code: 'NO_PIN' });
  const token = await signTestJwt({ privateKey, sub: 'user-4', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/verify-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: '123456' });

  expect(res.status).toBe(401);
  expect(res.body).toEqual({ code: 'NO_PIN' });
});

test('missing Authorization returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/verify-pin')
    .send({ pin: '123456' });

  expect(res.status).toBe(401);
  expect(verifyPin).not.toHaveBeenCalled();
});
