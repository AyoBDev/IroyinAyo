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
    const weeklyLeaderboard = require('../gamification/weeklyLeaderboard');
    const standings = await weeklyLeaderboard.getCurrentWeekStandings(20);
    res.json(standings);
  } catch (err) { next(err); }
});

router.get('/leaderboard/history', async (req, res, next) => {
  try {
    const weeklyLeaderboard = require('../gamification/weeklyLeaderboard');
    const weeks = await weeklyLeaderboard.getPastWeeks(4);
    res.json(weeks);
  } catch (err) { next(err); }
});

router.get('/sharp-money', async (req, res, next) => {
  try {
    const positions = await db('multi_market_positions')
      .join('students', 'multi_market_positions.student_id', 'students.id')
      .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
      .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
      .where('students.points_balance', '>=', 500)
      .where('multi_markets.status', 'open')
      .orderBy('multi_market_positions.created_at', 'desc')
      .limit(15)
      .select(
        'multi_market_positions.id',
        'multi_market_positions.amount',
        'multi_market_positions.created_at',
        'students.name as student_name',
        'students.points_balance',
        'multi_markets.title as market_title',
        'multi_market_outcomes.label as outcome_label'
      );
    res.json(positions);
  } catch (err) { next(err); }
});

router.get('/me/info', authenticateStudent, async (req, res, next) => {
  try {
    const { getStudentStats } = require('../gamification/titles');
    const weeklyLeaderboard = require('../gamification/weeklyLeaderboard');
    const stats = await getStudentStats(req.student.id);
    const weeklyRank = await weeklyLeaderboard.getWeeklyRank(req.student.id);
    res.json({
      id: req.student.id,
      name: req.student.name,
      points_balance: req.student.points_balance,
      title: stats.title,
      titleColor: stats.titleColor,
      accuracy: stats.accuracy,
      streak: stats.streak,
      totalPredictions: stats.totalPredictions,
      wins: stats.wins,
      weekly_rank: weeklyRank,
    });
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

router.get('/:id/share', async (req, res, next) => {
  try {
    const market = await multiMarkets.getMarketWithOdds(req.params.id);
    const winner = market.status === 'resolved'
      ? market.outcomes.find(o => o.id === market.winner_outcome_id)
      : null;
    const topOutcome = [...market.outcomes].sort((a, b) => b.price - a.price)[0];
    res.json({
      id: market.id,
      title: market.title,
      status: market.status,
      winner: winner ? { label: winner.label, price: winner.price } : null,
      topOutcome: topOutcome ? { label: topOutcome.label, price: topOutcome.price } : null,
      outcomeCount: market.outcomes.length,
    });
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
