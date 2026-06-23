const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const service = require('./weeklyWinner.service');

const router = express.Router();

router.get('/weekly-winner-status', authenticate, async (req, res, next) => {
  try {
    const result = await service.getWeeklyWinnerStatus();
    res.json({ winner: result });
  } catch (err) { next(err); }
});

router.post('/weekly-winner/:weekStart/mark-paid', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const weekStart = new Date(req.params.weekStart);
    if (isNaN(weekStart.getTime())) return res.status(400).json({ error: 'invalid weekStart' });
    const result = await service.markWinnerPaid(weekStart, req.admin.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
