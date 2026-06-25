const db = require('../config/database');
const { UnauthorizedError } = require('../utils/errors');
const { verifySupabaseToken } = require('./verifySupabaseToken');

async function requireSupabaseUser(req, res, next) {
  try {
    let auth;
    try {
      auth = await verifySupabaseToken(req.headers.authorization);
    } catch (err) {
      if (err instanceof UnauthorizedError) return next(err);
      return next(new UnauthorizedError('Authentication failed'));
    }

    const student = await db('students').where({ auth_user_id: auth.authUserId }).first();
    if (!student) {
      return res.status(401).json({
        error: 'Account not yet set up',
        code: 'BOOTSTRAP_REQUIRED',
      });
    }
    if (student.is_banned) return next(new UnauthorizedError('Account suspended'));

    req.student = student;
    req.supabaseUser = { id: auth.authUserId, email: auth.email };
    next();
  } catch (err) {
    next(new UnauthorizedError('Authentication failed'));
  }
}

module.exports = { requireSupabaseUser };
