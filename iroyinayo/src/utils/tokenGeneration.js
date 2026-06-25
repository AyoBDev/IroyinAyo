const jwt = require('jsonwebtoken');

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

module.exports = { generateStudentToken, generateUrlToken, verifyUrlToken };
