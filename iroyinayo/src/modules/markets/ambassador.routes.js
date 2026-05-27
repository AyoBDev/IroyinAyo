const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const multiMarkets = require('./multiMarkets.service');
const gamificationService = require('../gamification/gamification.service');
const { authenticateStudent } = require('../../middleware/studentAuth');
const { ValidationError } = require('../../utils/errors');

const MARKET_CREATION_BONUS = 25;
const MAX_MARKETS_PER_WEEK = 5;

function requireAmbassador(req, res, next) {
  if (!req.student.is_ambassador) {
    return res.status(403).json({ error: 'Ambassador access required' });
  }
  next();
}

router.get('/status', authenticateStudent, async (req, res) => {
  res.json({
    isAmbassador: req.student.is_ambassador || false,
    marketsCreated: req.student.markets_created || 0,
  });
});

router.post('/create-market', authenticateStudent, requireAmbassador, async (req, res, next) => {
  try {
    const { title, outcomes, category } = req.body;
    if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
      throw new ValidationError('Title and at least 2 outcomes required');
    }
    if (outcomes.length > 30) {
      throw new ValidationError('Maximum 30 outcomes per market');
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyCount = await db('multi_markets')
      .where('created_at', '>', weekAgo)
      .whereExists(function () {
        this.select('*').from('multi_market_positions')
          .whereRaw('multi_market_positions.market_id = multi_markets.id')
          .where('multi_market_positions.student_id', req.student.id);
      })
      .count('id as count')
      .first();

    const createdThisWeek = await db('multi_markets')
      .where('created_at', '>', weekAgo)
      .count('id as count')
      .first();

    if (parseInt(createdThisWeek?.count || 0, 10) >= MAX_MARKETS_PER_WEEK) {
      throw new ValidationError(`Maximum ${MAX_MARKETS_PER_WEEK} markets per week`);
    }

    const market = await multiMarkets.createMarket(title, null);

    if (category) {
      await db('multi_markets').where({ id: market.id }).update({ category });
    }

    for (const label of outcomes) {
      await multiMarkets.addOutcome(market.id, label.trim());
    }

    await db('students').where({ id: req.student.id }).increment('markets_created', 1);
    await gamificationService.addPoints(req.student.id, MARKET_CREATION_BONUS, 'ambassador', `Market created: ${title}`);

    const fullMarket = await multiMarkets.getMarketWithOdds(market.id);

    const { notifyNewMarket } = require('../notifications/whatsapp');
    notifyNewMarket(market.id).catch(() => {});

    res.json(fullMarket);
  } catch (err) { next(err); }
});

module.exports = router;
