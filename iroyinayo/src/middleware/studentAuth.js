const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : (() => { throw new Error('JWT_SECRET env var is required in production'); })());

function generateStudentToken(studentId) {
  return jwt.sign({ studentId }, JWT_SECRET, { expiresIn: '24h' });
}

function generateUrlToken(studentId) {
  return jwt.sign({ studentId, purpose: 'url_exchange' }, JWT_SECRET, { expiresIn: '5m' });
}

function verifyUrlToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'url_exchange') throw new Error('Invalid token purpose');
  return decoded;
}

async function authenticateStudent(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new UnauthorizedError('No token provided');
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose) throw new UnauthorizedError('Invalid token type');
    const student = await db('students').where({ id: decoded.studentId }).first();
    if (!student) throw new UnauthorizedError('Student not found');
    if (student.is_banned) throw new UnauthorizedError('Account suspended');
    req.student = student;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

module.exports = { generateStudentToken, generateUrlToken, verifyUrlToken, authenticateStudent };
