const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { ValidationError } = require('../../utils/errors');
const {
  sendCodeLimiter,
  verifyLimiter,
  quickJoinLimiter,
  exchangeTokenLimiter,
  otpIpBurstLimiter,
} = require('../../middleware/rateLimiter');

router.post('/send-code', otpIpBurstLimiter, sendCodeLimiter, async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (typeof phoneNumber !== 'string' || !phoneNumber) {
      throw new ValidationError('phoneNumber is required');
    }
    const result = await authService.sendCode(phoneNumber);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/verify', otpIpBurstLimiter, verifyLimiter, async (req, res, next) => {
  try {
    const { phoneNumber, code, name, referralCode } = req.body;
    if (typeof phoneNumber !== 'string' || !phoneNumber || typeof code !== 'string' || !code || typeof name !== 'string' || !name) {
      throw new ValidationError('phoneNumber, code, and name are required');
    }
    const result = await authService.verifyCode(phoneNumber, code, name, referralCode);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/login', otpIpBurstLimiter, sendCodeLimiter, async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (typeof phoneNumber !== 'string' || !phoneNumber) {
      throw new ValidationError('phoneNumber is required');
    }
    const result = await authService.login(phoneNumber);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/quick-join', quickJoinLimiter, async (req, res, next) => {
  try {
    const { phoneNumber, name, referralCode } = req.body;
    if (typeof phoneNumber !== 'string' || !phoneNumber || typeof name !== 'string' || !name) {
      throw new ValidationError('phoneNumber and name are required');
    }
    const result = await authService.quickJoin(phoneNumber, name, referralCode);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/exchange-token', exchangeTokenLimiter, async (req, res, next) => {
  try {
    const { urlToken } = req.body;
    if (!urlToken) throw new ValidationError('urlToken is required');
    const { verifyUrlToken, generateStudentToken } = require('../../middleware/studentAuth');
    const decoded = verifyUrlToken(urlToken);
    const db = require('../../config/database');
    const student = await db('students').where({ id: decoded.studentId }).first();
    if (!student) throw new ValidationError('Invalid token');
    const token = generateStudentToken(student.id);
    res.json({ token, student: { id: student.id, name: student.name, points_balance: student.points_balance } });
  } catch (err) {
    next(new ValidationError('Invalid or expired link. Please request a new one.'));
  }
});

module.exports = router;
