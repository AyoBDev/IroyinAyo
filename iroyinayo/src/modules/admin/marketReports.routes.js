const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const service = require('./marketReports.service');

const router = express.Router();

router.get('/market-reports', authenticate, async (req, res, next) => {
  try {
    const result = await service.listPendingReports();
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/market-reports/:id', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { action, note } = req.body || {};
    const result = await service.updateReport(req.params.id, req.admin.id, { action, note });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
