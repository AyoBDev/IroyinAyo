const express = require('express');
const router = express.Router();
const multiMarkets = require('./multiMarkets.service');
const gamificationService = require('../gamification/gamification.service');
const { authenticateStudent } = require('../../middleware/studentAuth');
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

router.get('/:id', async (req, res, next) => {
  try {
    const market = await multiMarkets.getMarketWithOdds(req.params.id);
    res.json(market);
  } catch (err) { next(err); }
});

router.post('/:id/bet', authenticateStudent, async (req, res, next) => {
  try {
    const { outcomeId, amount } = req.body;
    if (!outcomeId || !amount) throw new ValidationError('outcomeId and amount are required');
    if (amount < 1) throw new ValidationError('Amount must be at least 1');

    const result = await multiMarkets.buyPosition(req.params.id, outcomeId, req.student.id, amount);

    const io = req.app.get('io');
    if (io) {
      const marketWithOdds = await multiMarkets.getMarketWithOdds(req.params.id);
      const outcome = marketWithOdds.outcomes.find(o => o.id === outcomeId);
      io.emit('odds:update', { marketId: marketWithOdds.id, outcomes: marketWithOdds.outcomes.map(o => ({ id: o.id, price: o.price })) });
      io.emit('bet:placed', { marketId: marketWithOdds.id, outcomeLabel: outcome ? outcome.label : '', amount });
      const updatedStudent = await db('students').where({ id: req.student.id }).first();
      io.to(`student:${req.student.id}`).emit('balance:update', { studentId: req.student.id, balance: updatedStudent.points_balance });
    }

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
