const jose = require('jose');
const { UnauthorizedError } = require('../utils/errors');

let cachedGetKey = null;
let cachedJwksUrl = null;

function getJwksKeyResolver() {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!jwksUrl) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('SUPABASE_JWKS_URL env var is required');
    }
    return jose.createRemoteJWKSet(new URL('https://invalid'));
  }
  if (cachedGetKey && cachedJwksUrl === jwksUrl) return cachedGetKey;
  cachedJwksUrl = jwksUrl;
  cachedGetKey = jose.createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  return cachedGetKey;
}

async function verifySupabaseToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }
  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Empty token');

  const issuer = process.env.SUPABASE_JWT_ISSUER;
  if (!issuer && process.env.NODE_ENV !== 'test') {
    throw new Error('SUPABASE_JWT_ISSUER env var is required');
  }

  let payload;
  try {
    const verified = await jose.jwtVerify(token, getJwksKeyResolver(), {
      issuer,
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
