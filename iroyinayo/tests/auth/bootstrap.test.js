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

jest.mock('../../src/config/database', () => {
  const fn = jest.fn();
  fn.transaction = async (cb) => cb(fn);
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

// Helper to install a query stub for a single test
function setDb(impl) {
  db.mockImplementation(impl);
}

test('first call with valid JWT creates a student row', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-1', email: 'a@b.com' });

  let inserted;
  setDb((table) => {
    if (table === 'students') {
      return {
        where: () => ({ first: async () => null }),
        insert: (data) => ({
          returning: async () => {
            inserted = { id: 'student-1', referral_code: 'ABC123', ...data };
            return [inserted];
          },
        }),
      };
    }
    throw new Error('unexpected table: ' + table);
  });

  const res = await request(app)
    .post('/api/auth/bootstrap')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Tunde' });

  expect(res.status).toBe(200);
  expect(res.body.student.name).toBe('Tunde');
  expect(inserted.auth_user_id).toBe('user-1');
  expect(inserted.email).toBe('a@b.com');
  expect(inserted.points_balance).toBe(100);
  expect(inserted.campus).toBe('unilorin');
});

test('second call with same JWT is idempotent (returns existing row)', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-2', email: 'b@b.com' });

  setDb((table) => ({
    where: () => ({
      first: async () => ({
        id: 'student-2',
        auth_user_id: 'user-2',
        email: 'b@b.com',
        name: 'Tunde',
        points_balance: 100,
        referral_code: 'AAA111',
      }),
    }),
  }));

  const res = await request(app)
    .post('/api/auth/bootstrap')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Tunde' });

  expect(res.status).toBe(200);
  expect(res.body.student.id).toBe('student-2');
});

test('missing name → 400', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-3', email: 'c@b.com' });
  setDb(() => ({ where: () => ({ first: async () => null }) }));

  const res = await request(app)
    .post('/api/auth/bootstrap')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(res.status).toBe(400);
});

test('invalid referralCode (non-empty, no match) → 400', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-4', email: 'd@b.com' });

  setDb((table) => {
    if (table === 'students') {
      return {
        where: (cond) => ({
          first: async () => {
            if (cond.referral_code) return null;
            return null;
          },
        }),
        insert: () => ({ returning: async () => [{ id: 'student-4' }] }),
      };
    }
    throw new Error('unexpected: ' + table);
  });

  const res = await request(app)
    .post('/api/auth/bootstrap')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'X', referralCode: 'BAD-CODE' });
  expect(res.status).toBe(400);
});

test('no Authorization header → 401', async () => {
  const res = await request(app)
    .post('/api/auth/bootstrap')
    .send({ name: 'X' });
  expect(res.status).toBe(401);
});
