const express = require('express');
const db = require('../../config/database');
const { authenticateStudent } = require('../../middleware/studentAuth');
const { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank } = require('./accuracy');

const router = express.Router();

const SHARP_MOVE_PP = 0.10;
const SHARP_MOVE_WINDOW_MS = 60 * 60 * 1000;

router.get('/accuracy/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const allTime = await computeAccuracy(userId);
    const last30Days = await computeAccuracy(userId, { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const byCategory = await computeCategoryAccuracy(userId);
    const rank = await computeAccuracyRank(userId);
    const openPositions = await db('multi_market_positions as p')
      .join('multi_markets as m', 'p.market_id', 'm.id')
      .where('p.student_id', userId).where('m.status', 'open')
      .select('m.closes_at').orderBy('m.closes_at', 'asc');
    const openCallsCount = openPositions.length;
    const nextResolutionAt = openPositions.length > 0 ? openPositions[0].closes_at : null;
    res.json({ allTime, last30Days, byCategory, rank, openCallsCount, nextResolutionAt });
  } catch (err) {
    console.error('Accuracy fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch accuracy' });
  }
});

router.get('/triggers/in-app-strip', authenticateStudent, lastAppOpenMiddleware, async (req, res) => {
  try {
    const studentId = req.student.id;
    const openPositions = await db('multi_market_positions as p')
      .join('multi_markets as m', 'p.market_id', 'm.id')
      .where('p.student_id', studentId).where('m.status', 'open')
      .select('m.id', 'm.title').distinct();
    if (openPositions.length === 0) { res.json({ sharpMoves: [] }); return; }

    const since = new Date(Date.now() - SHARP_MOVE_WINDOW_MS);
    const sharpMoves = [];
    for (const market of openPositions) {
      const earliest = await db('market_price_snapshots')
        .where({ market_id: market.id })
        .where('captured_at', '>=', since)
        .orderBy('captured_at', 'asc')
        .first();
      const latest = await db('market_price_snapshots')
        .where({ market_id: market.id })
        .where('captured_at', '>=', since)
        .orderBy('captured_at', 'desc')
        .first();
      if (!earliest || !latest || earliest.id === latest.id) continue;
      const oldPrices = typeof earliest.prices === 'string' ? JSON.parse(earliest.prices) : earliest.prices;
      const newPrices = typeof latest.prices === 'string' ? JSON.parse(latest.prices) : latest.prices;
      const ownPosition = await db('multi_market_positions').where({ student_id: studentId, market_id: market.id }).select('outcome_id').first();
      const oldP = oldPrices.find((p) => p.outcome_id === ownPosition.outcome_id);
      const newP = newPrices.find((p) => p.outcome_id === ownPosition.outcome_id);
      if (!oldP || !newP) continue;
      const delta = Math.abs(newP.price - oldP.price);
      if (delta >= SHARP_MOVE_PP) sharpMoves.push({ marketId: market.id, title: market.title, oldPrice: oldP.price, newPrice: newP.price, deltaPp: Math.round(delta * 100) });
    }
    res.json({ sharpMoves });
  } catch (err) {
    console.error('In-app strip fetch failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/opt-in', authenticateStudent, lastAppOpenMiddleware, async (req, res) => {
  try {
    await db('students').where({ id: req.student.id }).update({ wa_daily_enabled: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

const LAST_OPEN_THROTTLE_MS = 5 * 60 * 1000;
const lastOpenCache = new Map();
function lastAppOpenMiddleware(req, res, next) {
  if (!req.student?.id) return next();
  const sid = req.student.id;
  const prev = lastOpenCache.get(sid);
  const now = Date.now();
  if (prev && now - prev < LAST_OPEN_THROTTLE_MS) return next();
  lastOpenCache.set(sid, now);
  db('students').where({ id: sid }).update({ last_app_open_at: new Date() }).catch(() => {});
  next();
}

module.exports = { router, lastAppOpenMiddleware };
