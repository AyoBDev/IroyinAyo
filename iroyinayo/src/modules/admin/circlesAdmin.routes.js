const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const service = require('./circlesAdmin.service');

const router = express.Router();

router.get('/overview', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await service.getOverviewStats();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/disputes', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await service.getDisputes();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/abandoned', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await service.getAbandonedCandidates();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/top-active', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await service.getTopActiveCircles(limit);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
