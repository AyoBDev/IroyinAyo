const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { UnauthorizedError } = require('../../utils/errors');
const { verifySupabaseToken } = require('../../middleware/verifySupabaseToken');

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

module.exports = router;
