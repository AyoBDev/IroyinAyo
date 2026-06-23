const express = require('express');
const { authenticate } = require('../../middleware/auth');
const service = require('./controlCenter.service');

const router = express.Router();

router.get('/control-center/summary', authenticate, async (req, res, next) => {
  try {
    const result = await service.getSummary();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/control-center/health', authenticate, async (req, res, next) => {
  try {
    const result = await service.getHealth();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
