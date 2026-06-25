const jose = require('jose');
const { UnauthorizedError } = require('../utils/errors');

const JWKS_URL = process.env.SUPABASE_JWKS_URL;
const ISSUER = process.env.SUPABASE_JWT_ISSUER;

if ((!JWKS_URL || !ISSUER) && process.env.NODE_ENV !== 'test') {
  throw new Error('SUPABASE_JWKS_URL and SUPABASE_JWT_ISSUER env vars are required');
}

// jose.createRemoteJWKSet caches keys in-memory (~10 minutes).
const getKey = jose.createRemoteJWKSet(new URL(JWKS_URL || 'https://invalid'), {
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
});

async function verifySupabaseToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }
  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Empty token');

  let payload;
  try {
    const verified = await jose.jwtVerify(token, getKey, {
      issuer: ISSUER,
      audience: 'authenticated',
    });
    payload = verified.payload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  if (!payload.sub) throw new UnauthorizedError('Token missing sub claim');
  return { authUserId: payload.sub, email: payload.email };
}

module.exports = { verifySupabaseToken };
