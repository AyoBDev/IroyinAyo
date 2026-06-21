const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { normalizePhone } = require('../modules/auth/auth.service');

const isTest = process.env.NODE_ENV === 'test';
const skipInTest = isTest ? () => true : () => false;

// Key rate limits by normalized phone number when the request carries one, so
// users on shared/CGNAT IPs (campus Wi-Fi, mobile carriers) don't lock each
// other out, and so the same number in different formats shares one bucket.
// Falls back to IP (via ipKeyGenerator, which handles IPv6 subnet bucketing).
function phoneOrIpKey(req) {
  const phone = req.body && req.body.phoneNumber;
  if (typeof phone !== 'string' || phone.length === 0) {
    return ipKeyGenerator(req.ip);
  }
  try {
    return `phone:${normalizePhone(phone)}`;
  } catch {
    return ipKeyGenerator(req.ip);
  }
}

// Secondary IP-keyed cap on OTP sends. Even though the primary limiter is
// phone-keyed (so legit users on shared IPs aren't punished), this stops one
// attacker IP from spamming OTPs to many different phone numbers.
const otpIpBurstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { error: 'Too many requests from this device. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin auth (admin login/register) - 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Student OTP send (send-code, login) - 5 per 15 minutes per phone
const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  keyGenerator: phoneOrIpKey,
  message: { error: 'Too many code requests for this number. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Student OTP verify - 10 per 15 minutes per phone (mistypes shouldn't block resends)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  keyGenerator: phoneOrIpKey,
  message: { error: 'Too many verification attempts. Please request a new code.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account creation via quick-join - 10 per hour per IP. Tuned to accommodate
// groups of students signing up together on shared campus Wi-Fi / CGNAT.
const quickJoinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  message: { error: 'Too many sign-up attempts from this device. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token exchange (persistent login link) - 20 per 15 minutes per IP
const exchangeTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: skipInTest,
  message: { error: 'Too many token exchange attempts. Please request a new link.' },
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

module.exports = {
  authLimiter,
  sendCodeLimiter,
  verifyLimiter,
  quickJoinLimiter,
  exchangeTokenLimiter,
  otpIpBurstLimiter,
  aiLimiter,
  generalLimiter,
};
