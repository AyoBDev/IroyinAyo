const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';
const skipInTest = isTest ? () => true : () => false;

// Strict: login/register - 5 attempts per 15 minutes
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

module.exports = { authLimiter, aiLimiter, generalLimiter };
