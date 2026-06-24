const express = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/adminRole');
const service = require('./aiMarket.service');

const router = express.Router();

function mapErrorToResponse(err, res) {
  if (err.code === 'rate_limit_exceeded') {
    return res.status(429).json({ error: 'rate_limit_exceeded', retryAfter: err.retryAfterSeconds });
  }
  if (err.code === 'invalid_prompt' || err.code === 'invalid_draft') {
    return res.status(400).json({ error: err.code, message: err.message, field: err.details?.field });
  }
  if (err.code === 'groq_not_configured') {
    console.error('aiMarket route: groq_not_configured', err);
    return res.status(500).json({ error: 'groq_not_configured', message: err.message });
  }
  if (err.code === 'groq_unavailable' || err.code === 'ai_returned_invalid_response' || err.code === 'ai_returned_invalid_draft') {
    console.error(`aiMarket route: ${err.code}`, err);
    return res.status(502).json({ error: err.code, message: err.message, field: err.details?.field });
  }
  return null;
}

router.post('/ai-market/draft', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { prompt } = req.body || {};
    const result = await service.draftMarket({ adminId: req.admin.id, prompt });
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

router.post('/ai-market/trends', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await service.getTrends({ adminId: req.admin.id });
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

router.post('/ai-market/publish', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await service.publishMarket(req.body || {});
    res.json(result);
  } catch (err) {
    if (mapErrorToResponse(err, res)) return;
    next(err);
  }
});

module.exports = router;
