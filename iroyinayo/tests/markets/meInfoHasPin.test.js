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

// Stub out gamification/leaderboard/referrals to keep this test focused.
jest.mock('../../src/modules/gamification/titles', () => ({
  getStudentStats: async () => ({
    title: 'Predictor',
    titleColor: '#fff',
    accuracy: 0,
    streak: 0,
    totalPredictions: 0,
    wins: 0,
  }),
}));
jest.mock('../../src/modules/gamification/weeklyLeaderboard', () => ({
  getWeeklyStandingForStudent: async () => ({ rank: null, wins: 0, totalWon: 0, predictions: 0 }),
}));
jest.mock('../../src/modules/referrals/referrals.service', () => ({
  getReferralStats: async () => ({ code: 'ABC123', referralCount: 0 }),
}));

jest.mock('../../src/config/database', () => {
  const fn = jest.fn();
  return fn;
});

const db = require('../../src/config/database');
const app = require('../../src/app');

let privateKey;

beforeAll(async () => {
  process.env.SUPABASE_JWKS_URL = 'https://test.supabase.co/auth/v1/.well-known/jwks.json';
  process.env.SUPABASE_JWT_ISSUER = 'https://test.supabase.co/auth/v1';
  const kp = await generateKeyPair();
  privateKey = kp.privateKey;
  mockedPublicKey = kp.publicKey;
});

function makeStudentRow({ pinHash = null } = {}) {
  return {
    id: 'student-1',
    auth_user_id: 'user-1',
    email: 'a@b.com',
    name: 'Tunde',
    points_balance: 100,
    is_banned: false,
    is_ambassador: false,
    referred_by: null,
    pin_hash: pinHash,
  };
}

function setDb(impl) {
  db.mockImplementation(impl);
}

test('has_pin is true when pin_hash is set', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  setDb(() => ({
    where: () => ({ first: async () => makeStudentRow({ pinHash: 'hash' }), update: async () => 1 }),
  }));

  const res = await request(app)
    .get('/api/multi-markets/me/info')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.has_pin).toBe(true);
});

test('has_pin is false when pin_hash is null', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });
  setDb(() => ({
    where: () => ({ first: async () => makeStudentRow({ pinHash: null }), update: async () => 1 }),
  }));

  const res = await request(app)
    .get('/api/multi-markets/me/info')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.has_pin).toBe(false);
});
