const express = require('express');
const router = express.Router();
const referrals = require('./referrals.service');
const { authenticateStudent } = require('../../middleware/studentAuth');

router.get('/me', authenticateStudent, async (req, res, next) => {
  try {
    const stats = await referrals.getReferralStats(req.student.id);
    res.json(stats);
  } catch (err) { next(err); }
});

router.post('/apply', authenticateStudent, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Referral code is required' });
    const result = await referrals.applyReferral(req.student.id, code.toUpperCase());
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
