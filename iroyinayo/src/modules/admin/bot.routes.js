const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const db = require('../../config/database');

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

// Wipes the stored Baileys auth credentials so the next reconnect starts a fresh
// pairing flow. Required when WhatsApp force-logs out the session and the cached
// creds become invalid. Super-admin only.
router.post('/bot/reset-session', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { confirm } = req.body || {};
    if (confirm !== 'YES_RESET_SESSION') {
      return res.status(400).json({ error: 'Pass confirm: "YES_RESET_SESSION" in the body to proceed.' });
    }

    const { setBotSocket, getBotSocket } = require('../../bot/botSocket');
    const { createConnection } = require('../../bot/connection');
    const { handleMessage } = require('../../bot/messageHandler');

    const current = getBotSocket();
    if (current) {
      try { current.end(undefined); } catch (err) { console.error('[bot/reset-session] sock.end failed:', err.message); }
      setBotSocket(null);
    }

    const deleted = await db('baileys_auth').del();
    console.log(`[bot/reset-session] cleared ${deleted} baileys_auth rows`);

    createConnection(handleMessage).catch((err) => console.error('[bot/reset-session] reconnect failed:', err.message));

    return res.json({
      status: 'reset',
      message: `Session cleared (${deleted} rows). Visit the bot QR endpoint and scan within 60s to re-pair.`,
    });
  } catch (err) {
    console.error('[bot/reset-session] failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
