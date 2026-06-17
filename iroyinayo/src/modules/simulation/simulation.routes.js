const router = require('express').Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');

router.get('/alerts', authenticate, async (req, res, next) => {
  try {
    const { status, alert_type, market_id } = req.query;
    let query = db('simulation_alerts')
      .join('multi_markets', 'simulation_alerts.market_id', 'multi_markets.id')
      .select(
        'simulation_alerts.*',
        'multi_markets.title as market_title'
      )
      .orderBy('simulation_alerts.created_at', 'desc');

    if (status) query = query.where('simulation_alerts.status', status);
    if (alert_type) query = query.where('simulation_alerts.alert_type', alert_type);
    if (market_id) query = query.where('simulation_alerts.market_id', market_id);

    const alerts = await query.limit(100);
    res.json(alerts);
  } catch (err) { next(err); }
});

router.patch('/alerts/:id', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['acknowledged', 'acted_on', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = { status };
    if (status === 'acted_on' || status === 'dismissed') {
      update.resolved_at = new Date();
    }

    const [alert] = await db('simulation_alerts')
      .where({ id: req.params.id })
      .update(update)
      .returning('*');

    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
});

router.get('/markets/:marketId/results', authenticate, async (req, res, next) => {
  try {
    const results = await db('market_simulations')
      .where({ market_id: req.params.marketId })
      .orderBy('run_at', 'desc')
      .limit(20);
    res.json(results);
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const totalRuns = await db('market_simulations').count('id as count').first();
    const pendingAlerts = await db('simulation_alerts').where({ status: 'pending' }).count('id as count').first();
    const recentRuns = await db('market_simulations')
      .where('run_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('id as count').first();

    res.json({
      total_simulations: parseInt(totalRuns.count),
      pending_alerts: parseInt(pendingAlerts.count),
      simulations_last_24h: parseInt(recentRuns.count),
    });
  } catch (err) { next(err); }
});

module.exports = router;
