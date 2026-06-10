const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const liquidityConfig = require('./liquidity.config');
const liquidityService = require('./liquidity.service');
const oddsApiAdapter = require('./adapters/oddsApi.adapter');
const db = require('../../config/database');
const { ValidationError } = require('../../utils/errors');

router.post('/config', authenticate, async (req, res, next) => {
  try {
    const { market_id, multi_market_id, source_type, target_probabilities, odds_api_event_id, odds_api_market_key, drift_threshold, correction_strength, max_correction_amount, cooldown_seconds } = req.body;

    if (!market_id && !multi_market_id) {
      throw new ValidationError('Either market_id or multi_market_id is required');
    }

    const config = await liquidityConfig.create({
      market_id, multi_market_id, source_type, target_probabilities,
      odds_api_event_id, odds_api_market_key,
      drift_threshold, correction_strength, max_correction_amount, cooldown_seconds,
    });

    const marketType = market_id ? 'binary' : 'multi';
    const targetId = market_id || multi_market_id;
    setImmediate(async () => {
      try {
        await liquidityService.seed(targetId, marketType);
      } catch (err) {
        console.error('Seed error:', err.message);
      }
    });

    res.status(201).json({ config });
  } catch (err) { next(err); }
});

router.get('/config', authenticate, async (req, res, next) => {
  try {
    const configs = await liquidityConfig.listAll();
    res.json({ configs });
  } catch (err) { next(err); }
});

router.put('/config/:id', authenticate, async (req, res, next) => {
  try {
    const { target_probabilities, drift_threshold, correction_strength, max_correction_amount, cooldown_seconds, enabled, source_type, odds_api_event_id, odds_api_market_key } = req.body;

    const fields = {};
    if (target_probabilities !== undefined) fields.target_probabilities = target_probabilities;
    if (drift_threshold !== undefined) fields.drift_threshold = drift_threshold;
    if (correction_strength !== undefined) fields.correction_strength = correction_strength;
    if (max_correction_amount !== undefined) fields.max_correction_amount = max_correction_amount;
    if (cooldown_seconds !== undefined) fields.cooldown_seconds = cooldown_seconds;
    if (enabled !== undefined) fields.enabled = enabled;
    if (source_type !== undefined) fields.source_type = source_type;
    if (odds_api_event_id !== undefined) fields.odds_api_event_id = odds_api_event_id;
    if (odds_api_market_key !== undefined) fields.odds_api_market_key = odds_api_market_key;

    const config = await liquidityConfig.update(req.params.id, fields);

    if (target_probabilities) {
      const marketType = config.market_id ? 'binary' : 'multi';
      const targetId = config.market_id || config.multi_market_id;
      setImmediate(async () => {
        try { await liquidityService.seed(targetId, marketType); } catch (err) { console.error('Re-seed error:', err.message); }
      });
    }

    res.json({ config });
  } catch (err) { next(err); }
});

router.delete('/config/:id', authenticate, async (req, res, next) => {
  try {
    await liquidityConfig.remove(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const system = await db('students').where({ is_system: true }).first();
    const systemBalance = system ? system.points_balance : 0;

    const configs = await liquidityConfig.listAll();
    const activeConfigs = configs.filter(c => c.enabled).length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTrades = await db('point_transactions')
      .where({ student_id: system?.id })
      .where('type', 'liquidity_bot')
      .where('created_at', '>=', todayStart);

    const totalCorrectionsToday = todayTrades.length;
    const totalPointsSpentToday = todayTrades.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastCorrection = configs
      .filter(c => c.last_correction_at)
      .sort((a, b) => new Date(b.last_correction_at) - new Date(a.last_correction_at))[0];

    res.json({
      system_balance: systemBalance,
      total_corrections_today: totalCorrectionsToday,
      total_points_spent_today: totalPointsSpentToday,
      active_configs: activeConfigs,
      last_correction_at: lastCorrection?.last_correction_at || null,
    });
  } catch (err) { next(err); }
});

router.get('/odds-api/events', authenticate, async (req, res, next) => {
  try {
    const sport = req.query.sport || 'soccer_fifa_world_cup';
    const events = await oddsApiAdapter.listEvents(sport);
    res.json({ events });
  } catch (err) { next(err); }
});

module.exports = router;
