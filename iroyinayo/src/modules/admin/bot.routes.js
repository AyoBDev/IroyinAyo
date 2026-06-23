const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');

const router = express.Router();

router.post('/bot/reconnect', authenticate, requireRole('super_admin', 'moderator'), async (req, res) => {
  try {
    const { getBotSocket } = require('../../bot/botSocket');
    const { createConnection } = require('../../bot/connection');

    const current = getBotSocket();
    if (current) {
      return res.json({ status: 'already_connected', message: 'WhatsApp bot socket is already connected.' });
    }

    // Fire-and-forget; do not await — return promptly so the dashboard sees a quick response.
    createConnection().catch((err) => console.error('[bot/reconnect] failed:', err.message));
    return res.json({ status: 'reconnecting', message: 'Reconnect initiated. Check status pill in 5-10 seconds.' });
  } catch (err) {
    return res.json({ status: 'failed', message: err.message });
  }
});

module.exports = router;
