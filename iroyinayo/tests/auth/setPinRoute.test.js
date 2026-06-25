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

const { setPin } = require('../../src/modules/auth/pin.service');
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
  setPin.mockReset();
});

test('valid token and pin returns 200 and calls setPin', async () => {
  setPin.mockResolvedValue();
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/set-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: '123456' });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
  expect(setPin).toHaveBeenCalledWith({ authUserId: 'user-1', pin: '123456' });
});

test('invalid pin format returns 400', async () => {
  const { ValidationError } = require('../../src/utils/errors');
  setPin.mockRejectedValue(new ValidationError('pin must be 6 digits'));
  const token = await signTestJwt({ privateKey, sub: 'user-2', email: 'a@b.com' });

  const res = await request(app)
    .post('/api/auth/set-pin')
    .set('Authorization', `Bearer ${token}`)
    .send({ pin: 'abcdef' });

  expect(res.status).toBe(400);
});

test('missing Authorization returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/set-pin')
    .send({ pin: '123456' });

  expect(res.status).toBe(401);
  expect(setPin).not.toHaveBeenCalled();
});
