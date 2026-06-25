const jose = require('jose');

async function generateKeyPair() {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256', { extractable: true });
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return { privateKey, publicKey, jwk };
}

async function signTestJwt({ privateKey, sub, email, expiresIn = '1h', issuer = 'https://test.supabase.co/auth/v1' }) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (typeof expiresIn === 'number' ? expiresIn : 3600);
  return new jose.SignJWT({ email, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);
}

function mockRemoteJWKSet({ publicKey }) {
  // Returns a function with the same shape as jose.createRemoteJWKSet:
  // (protectedHeader, token) => Promise<KeyLike>
  return async () => publicKey;
}

module.exports = { generateKeyPair, signTestJwt, mockRemoteJWKSet };
