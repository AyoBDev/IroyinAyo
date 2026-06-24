const express = require('express');
const router = express.Router();
const broadcastService = require('./broadcast.service');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const { ValidationError } = require('../../utils/errors');

// Accept up to ~15 MB JSON to allow a base64-encoded poster image.
const jsonParser = express.json({ limit: '15mb' });

function decodeImage(imageBase64) {
  if (!imageBase64) return null;
  const cleaned = imageBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  return Buffer.from(cleaned, 'base64');
}

router.post('/test', jsonParser, authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { phone, caption, imageBase64 } = req.body || {};
    if (!phone) throw new ValidationError('phone is required');
    const imageBuffer = decodeImage(imageBase64);
    if (!caption && !imageBuffer) throw new ValidationError('caption or imageBase64 is required');
    const result = await broadcastService.sendToOne(phone, caption || '', imageBuffer);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/', jsonParser, authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { caption, imageBase64, confirm } = req.body || {};
    if (confirm !== 'YES_SEND_TO_ALL') {
      throw new ValidationError('Pass confirm: "YES_SEND_TO_ALL" to broadcast to every student.');
    }
    const imageBuffer = decodeImage(imageBase64);
    if (!caption && !imageBuffer) throw new ValidationError('caption or imageBase64 is required');

    // Fire and forget: the broadcast can run for many minutes due to pacing.
    broadcastService.broadcastToAll(caption || '', imageBuffer).catch((err) => {
      console.error('[broadcast] background run failed:', err);
    });

    res.status(202).json({ ok: true, message: 'Broadcast started. Check server logs for [broadcast] progress lines.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
