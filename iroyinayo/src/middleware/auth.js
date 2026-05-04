const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const db = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new UnauthorizedError('No token provided');
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    const admin = await db('admins').where({ id: decoded.id }).first();
    if (!admin) throw new UnauthorizedError('Admin not found');
    req.admin = admin;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    next(new UnauthorizedError('Invalid token'));
  }
}

module.exports = { authenticate };
