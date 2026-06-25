const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { UnauthorizedError } = require('../../utils/errors');
const { verifySupabaseToken } = require('../../middleware/verifySupabaseToken');
const { setPin, verifyPin, clearPinLockout } = require('./pin.service');

router.post('/bootstrap', async (req, res, next) => {
  try {
    let auth;
    try {
      auth = await verifySupabaseToken(req.headers.authorization);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }

    const { name, phoneNumber, pin, referralCode } = req.body || {};
    const { student } = await authService.bootstrapStudent({
      authUserId: auth.authUserId,
      email: auth.email,
      name,
      phoneNumber,
      pin,
      referralCode,
    });

    res.json({
      student: {
        id: student.id,
        name: student.name,
        points_balance: student.points_balance,
        referral_code: student.referral_code,
        email: student.email,
        campus: student.campus,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/set-pin', async (req, res, next) => {
  try {
    let auth;
    try {
      auth = await verifySupabaseToken(req.headers.authorization);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }

    const { pin } = req.body || {};
    await setPin({ authUserId: auth.authUserId, pin });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-pin', async (req, res, next) => {
  try {
    let auth;
    try {
      auth = await verifySupabaseToken(req.headers.authorization);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }

    const { pin } = req.body || {};
    const result = await verifyPin({ authUserId: auth.authUserId, pin });

    if (result.ok) {
      return res.json({ ok: true });
    }

    const body = { code: result.code };
    if (typeof result.attemptsRemaining === 'number') {
      body.attempts_remaining = result.attemptsRemaining;
    }
    return res.status(401).json(body);
  } catch (err) {
    next(err);
  }
});

router.post('/clear-pin-lockout', async (req, res, next) => {
  try {
    let auth;
    try {
      auth = await verifySupabaseToken(req.headers.authorization);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }

    await clearPinLockout({ authUserId: auth.authUserId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
