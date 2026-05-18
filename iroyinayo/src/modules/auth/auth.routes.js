const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { ValidationError } = require('../../utils/errors');
const { authLimiter } = require('../../middleware/rateLimiter');

router.use(authLimiter);

router.post('/send-code', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) throw new ValidationError('phoneNumber is required');
    const result = await authService.sendCode(phoneNumber);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/verify', async (req, res, next) => {
  try {
    const { phoneNumber, code, name } = req.body;
    if (!phoneNumber || !code || !name) throw new ValidationError('phoneNumber, code, and name are required');
    const result = await authService.verifyCode(phoneNumber, code, name);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) throw new ValidationError('phoneNumber is required');
    const result = await authService.login(phoneNumber);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/exchange-token', async (req, res, next) => {
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
