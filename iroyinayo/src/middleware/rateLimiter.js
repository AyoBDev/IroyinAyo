const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';
const skipInTest = isTest ? () => true : () => false;

// Admin auth (admin login/register) - 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI generation - 10 requests per hour
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  message: { error: 'AI generation rate limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API - 100 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  skip: skipInTest,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Predict — guard against network retries / double-submits. 5 requests per
// 2 seconds per authenticated student (keyed off req.student.id, set upstream
// by the auth middleware). Falls back to IP if the auth middleware hasn't run.
const predictLimiter = rateLimit({
  windowMs: 2 * 1000,
  max: 5,
  skip: skipInTest,
  keyGenerator: (req, res) => (req.student && req.student.id) || ipKeyGenerator(req, res),
  message: { error: 'You are placing predictions too quickly. Try again in a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  aiLimiter,
  generalLimiter,
  predictLimiter,
};
