const { generateKeyPair, signTestJwt, mockRemoteJWKSet } = require('./testJwks');

// We mock the JWKS factory before requiring the middleware.
let mockedPublicKey;
jest.mock('jose', () => {
  const actual = jest.requireActual('jose');
  return {
    ...actual,
    createRemoteJWKSet: jest.fn(() => async () => mockedPublicKey),
  };
});

jest.mock('../../src/config/database', () => {
  const queries = [];
  const fake = (table) => ({
    where: (cond) => ({
      first: async () => {
        queries.push({ table, cond });
        return fake.__nextRow;
      },
    }),
  });
  fake.__queries = queries;
  fake.__nextRow = null;
  return fake;
});

const db = require('../../src/config/database');
const { requireSupabaseUser } = require('../../src/middleware/requireSupabaseUser');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

let privateKey;

beforeAll(async () => {
  process.env.SUPABASE_JWKS_URL = 'https://test.supabase.co/auth/v1/.well-known/jwks.json';
  process.env.SUPABASE_JWT_ISSUER = 'https://test.supabase.co/auth/v1';
  const kp = await generateKeyPair();
  privateKey = kp.privateKey;
  mockedPublicKey = kp.publicKey;
});

beforeEach(() => {
  db.__queries.length = 0;
  db.__nextRow = null;
});

test('valid JWT + existing student row → calls next with no error and sets req.student', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-uuid-1', email: 'a@b.com' });
  db.__nextRow = { id: 'student-uuid-1', auth_user_id: 'user-uuid-1', email: 'a@b.com', is_banned: false };
  const req = { headers: { authorization: `Bearer ${token}` } };
  const next = jest.fn();
  await requireSupabaseUser(req, makeRes(), next);
  expect(next).toHaveBeenCalledWith();
  expect(req.student.id).toBe('student-uuid-1');
});

test('valid JWT but no student row → 401 BOOTSTRAP_REQUIRED', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-uuid-2', email: 'c@d.com' });
  db.__nextRow = null;
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = makeRes();
  const next = jest.fn();
  await requireSupabaseUser(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ error: expect.any(String), code: 'BOOTSTRAP_REQUIRED' });
  expect(next).not.toHaveBeenCalled();
});

test('expired JWT → 401', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-uuid-3', email: 'a@b.com', expiresIn: -10 });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const next = jest.fn();
  await requireSupabaseUser(req, makeRes(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
});

test('missing Authorization header → 401', async () => {
  const req = { headers: {} };
  const next = jest.fn();
  await requireSupabaseUser(req, makeRes(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
});

test('malformed Authorization header → 401', async () => {
  const req = { headers: { authorization: 'NotBearer xxx' } };
  const next = jest.fn();
  await requireSupabaseUser(req, makeRes(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
});

test('banned student → 401', async () => {
  const token = await signTestJwt({ privateKey, sub: 'user-uuid-4', email: 'b@b.com' });
  db.__nextRow = { id: 'student-uuid-4', auth_user_id: 'user-uuid-4', email: 'b@b.com', is_banned: true };
  const req = { headers: { authorization: `Bearer ${token}` } };
  const next = jest.fn();
  await requireSupabaseUser(req, makeRes(), next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
});
