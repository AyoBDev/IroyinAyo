const express = require('express');
const router = express.Router();
const multiMarkets = require('./multiMarkets.service');
const gamificationService = require('../gamification/gamification.service');
const { authenticateStudent } = require('../../middleware/studentAuth');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');
const db = require('../../config/database');

router.get('/', async (req, res, next) => {
  try {
    const markets = await multiMarkets.listOpenMarkets();
    res.json(markets);
  } catch (err) { next(err); }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const entries = await gamificationService.getLeaderboard('weekly', 10);
    res.json(entries);
  } catch (err) { next(err); }
});

router.get('/me/info', authenticateStudent, async (req, res, next) => {
  try {
    res.json({ id: req.student.id, name: req.student.name, points_balance: req.student.points_balance });
  } catch (err) { next(err); }
});

router.get('/me/positions', authenticateStudent, async (req, res, next) => {
  try {
    const positions = await multiMarkets.getStudentPositions(req.student.id);
    res.json(positions);
  } catch (err) { next(err); }
});

// Admin endpoints (must be before /:id to avoid route conflict)
router.get('/admin/all', authenticate, async (req, res, next) => {
  try {
    const markets = await db('multi_markets').orderBy('created_at', 'desc');
    const allOutcomes = await db('multi_market_outcomes').select('*');
    const result = markets.map(m => ({
      ...m,
      outcomes: allOutcomes.filter(o => o.market_id === m.id),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const market = await multiMarkets.getMarketWithOdds(req.params.id);
    res.json(market);
  } catch (err) { next(err); }
});

router.post('/:id/predict', authenticateStudent, async (req, res, next) => {
  try {
    const { outcomeId } = req.body;
    const amount = Math.floor(Number(req.body.amount));
    if (!outcomeId || !amount) throw new ValidationError('outcomeId and amount are required');
    if (!Number.isFinite(amount) || amount < 1) throw new ValidationError('Amount must be at least 1');
    if (amount > 1000) throw new ValidationError('Maximum prediction is 1000 points');

    const result = await multiMarkets.buyPosition(req.params.id, outcomeId, req.student.id, amount);

    const io = req.app.get('io');
    if (io) {
      const marketWithOdds = await multiMarkets.getMarketWithOdds(req.params.id);
      const outcome = marketWithOdds.outcomes.find(o => o.id === outcomeId);
      io.emit('odds:update', { marketId: marketWithOdds.id, outcomes: marketWithOdds.outcomes.map(o => ({ id: o.id, price: o.price })) });
      io.emit('prediction:placed', { marketId: marketWithOdds.id, outcomeLabel: outcome ? outcome.label : '', amount });
      const updatedStudent = await db('students').where({ id: req.student.id }).first();
      io.to(`student:${req.student.id}`).emit('balance:update', { studentId: req.student.id, balance: updatedStudent.points_balance });
    }

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/resolve', authenticate, async (req, res, next) => {
  try {
    const { outcomeId } = req.body;
    if (!outcomeId) throw new ValidationError('outcomeId is required');
    const result = await multiMarkets.resolveMarket(req.params.id, outcomeId);

    const io = req.app.get('io');
    if (io) {
      const outcome = await db('multi_market_outcomes').where({ id: outcomeId }).first();
      io.emit('market:resolved', { marketId: req.params.id, winnerLabel: outcome?.label || '', winnerId: outcomeId });
    }

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
