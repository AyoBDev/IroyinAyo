const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { ValidationError } = require('../../utils/errors');

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
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) throw new ValidationError('phoneNumber and code are required');
    const result = await authService.verifyCode(phoneNumber, code);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
