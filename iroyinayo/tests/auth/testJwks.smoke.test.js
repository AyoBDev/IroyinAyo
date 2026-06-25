const jose = require('jose');
const { generateKeyPair, signTestJwt, mockRemoteJWKSet } = require('./testJwks');

test('signed token verifies against mocked JWKS', async () => {
  const { privateKey, publicKey } = await generateKeyPair();
  const token = await signTestJwt({ privateKey, sub: 'abc', email: 'a@b.com' });
  const getKey = mockRemoteJWKSet({ publicKey });
  const { payload } = await jose.jwtVerify(token, getKey, {
    issuer: 'https://test.supabase.co/auth/v1',
    audience: 'authenticated',
  });
  expect(payload.sub).toBe('abc');
  expect(payload.email).toBe('a@b.com');
});
