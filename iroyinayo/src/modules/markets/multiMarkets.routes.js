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

router.get('/social-proof', async (req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const activeResult = await db('multi_market_positions')
      .join('students', 'multi_market_positions.student_id', 'students.id')
      .where('multi_market_positions.created_at', '>=', weekAgo)
      .where('students.is_system', false)
      .countDistinct('students.id as count')
      .first();

    const recentWinners = await db('multi_market_positions')
      .join('students', 'multi_market_positions.student_id', 'students.id')
      .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
      .where('multi_market_positions.payout', '>', 0)
      .where('students.is_system', false)
      .orderBy('multi_markets.resolved_at', 'desc')
      .limit(5)
      .select(
        'students.name',
        'multi_market_positions.payout',
        'multi_markets.title as market_title',
        'multi_markets.resolved_at'
      );

    const totalPredictions = await db('multi_market_positions')
      .where('created_at', '>=', weekAgo)
      .count('id as count')
      .first();

    res.json({
      activePredictors: parseInt(activeResult?.count || 0, 10),
      predictionsThisWeek: parseInt(totalPredictions?.count || 0, 10),
      recentWinners: recentWinners.map(w => ({
        name: w.name,
        payout: w.payout,
        marketTitle: w.market_title,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const weeklyLeaderboard = require('../gamification/weeklyLeaderboard');
    let standings = await weeklyLeaderboard.getCurrentWeekStandings(20);
    let period = 'weekly';
    if (standings.length === 0) {
      standings = await weeklyLeaderboard.getAllTimeStandings(20);
      period = 'all-time';
    }
    res.json({ standings, period });
  } catch (err) { next(err); }
});

router.get('/top-predictors', async (req, res, next) => {
  try {
    const { start, end } = require('../gamification/weeklyLeaderboard').getWeekBounds();
    const predictors = await db('multi_market_positions')
      .join('students', 'multi_market_positions.student_id', 'students.id')
      .where('multi_market_positions.created_at', '>=', start)
      .where('multi_market_positions.created_at', '<=', end)
      .where('students.is_system', false)
      .groupBy('students.id', 'students.name')
      .select(
        'students.id',
        'students.name',
        db.raw('COALESCE(SUM(multi_market_positions.amount), 0) as total_wagered'),
        db.raw('COUNT(multi_market_positions.id) as predictions')
      )
      .orderBy('total_wagered', 'desc')
      .limit(10);

    res.json(predictors.map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.name,
      points: parseInt(s.total_wagered, 10),
      predictions: parseInt(s.predictions, 10),
    })));
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
      .where('students.is_system', false)
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
    const { getReferralStats } = require('../referrals/referrals.service');
    const stats = await getStudentStats(req.student.id);
    const weeklyRank = await weeklyLeaderboard.getWeeklyRank(req.student.id);
    const referralStats = await getReferralStats(req.student.id);

    let referredByName = null;
    if (req.student.referred_by) {
      const referrer = await db('students').where({ id: req.student.referred_by }).select('name').first();
      referredByName = referrer?.name || null;
    }

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
      is_ambassador: req.student.is_ambassador || false,
      referral_code: referralStats.code,
      referral_count: referralStats.referralCount,
      referred_by_name: referredByName,
    });
  } catch (err) { next(err); }
});

router.get('/me/positions', authenticateStudent, async (req, res, next) => {
  try {
    const positions = await multiMarkets.getStudentPositions(req.student.id);
    res.json(positions);
  } catch (err) { next(err); }
});

router.get('/me/portfolio', authenticateStudent, async (req, res, next) => {
  try {
    const portfolio = await multiMarkets.getPortfolio(req.student.id);
    res.json(portfolio);
  } catch (err) { next(err); }
});

router.get('/me/created', authenticateStudent, async (req, res, next) => {
  try {
    const markets = await db('multi_markets')
      .where({ created_by: req.student.id })
      .orderBy('created_at', 'desc');

    const marketsWithOdds = await Promise.all(
      markets.map((m) => multiMarkets.getMarketWithOdds(m.id))
    );

    const marketsWithVolume = await Promise.all(
      marketsWithOdds.map(async (m) => {
        const vol = await db('multi_market_positions')
          .where({ market_id: m.id })
          .sum('amount as total_volume')
          .first();
        return { ...m, total_volume: parseInt(vol?.total_volume || 0, 10) };
      })
    );

    res.json(marketsWithVolume);
  } catch (err) { next(err); }
});

router.get('/me/wins', authenticateStudent, async (req, res, next) => {
  try {
    const wins = await db('multi_market_positions')
      .join('multi_markets', 'multi_market_positions.market_id', 'multi_markets.id')
      .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
      .where({
        'multi_market_positions.student_id': req.student.id,
        'multi_market_positions.win_acknowledged': false,
      })
      .where('multi_market_positions.payout', '>', 0)
      .select(
        'multi_market_positions.id',
        'multi_market_positions.payout',
        'multi_market_positions.amount',
        'multi_market_positions.entry_price',
        'multi_markets.title as market_title',
        'multi_market_outcomes.label as outcome_label'
      );

    const student = await db('students').where({ id: req.student.id }).select('referral_code').first();
    res.json(wins.map(w => ({ ...w, referral_code: student?.referral_code || '' })));
  } catch (err) { next(err); }
});

router.post('/me/wins/acknowledge', authenticateStudent, async (req, res, next) => {
  try {
    await db('multi_market_positions')
      .where({ student_id: req.student.id })
      .where('payout', '>', 0)
      .update({ win_acknowledged: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/create', authenticateStudent, async (req, res, next) => {
  try {
    const { title, outcomes, category, closesAt } = req.body;
    const market = await multiMarkets.createUserMarket(req.student.id, { title, outcomes, category, closesAt });
    res.json(market);
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

router.post('/admin/create', authenticate, async (req, res, next) => {
  try {
    const { title, outcomes, category, liquidityB, sponsor } = req.body;
    if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
      throw new ValidationError('Title and at least 2 outcomes required');
    }

    const sponsorData = sponsor ? {
      sponsorName: sponsor.name,
      sponsorLogoUrl: sponsor.logoUrl,
      featured: sponsor.featured || false,
    } : null;

    const market = await multiMarkets.createMarket(title, liquidityB || null, sponsorData);

    if (category) {
      await db('multi_markets').where({ id: market.id }).update({ category });
    }

    for (const label of outcomes) {
      if (label.trim()) {
        await multiMarkets.addOutcome(market.id, label.trim());
      }
    }

    await multiMarkets.seedMarketLiquidity(market.id);

    const fullMarket = await multiMarkets.getMarketWithOdds(market.id);
    res.json(fullMarket);
  } catch (err) { next(err); }
});

router.get('/admin/liquidity-info', authenticate, async (req, res, next) => {
  try {
    const autoB = await multiMarkets.getAutoLiquidityB();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await db('students')
      .join('point_transactions', 'students.id', 'point_transactions.student_id')
      .where('point_transactions.created_at', '>', weekAgo)
      .countDistinct('students.id as active_users')
      .first();
    res.json({ autoLiquidityB: autoB, activeUsers: parseInt(result?.active_users || 0, 10) });
  } catch (err) { next(err); }
});

router.get('/admin/:id/analytics', authenticate, async (req, res, next) => {
  try {
    const marketId = req.params.id;
    const market = await multiMarkets.getMarketWithOdds(marketId);
    if (!market) throw new ValidationError('Market not found');

    const positions = await db('multi_market_positions')
      .join('students', 'multi_market_positions.student_id', 'students.id')
      .join('multi_market_outcomes', 'multi_market_positions.outcome_id', 'multi_market_outcomes.id')
      .where('multi_market_positions.market_id', marketId)
      .where('students.is_system', false)
      .select(
        'multi_market_positions.id',
        'multi_market_positions.amount',
        'multi_market_positions.shares',
        'multi_market_positions.payout',
        'multi_market_positions.entry_price',
        'multi_market_positions.created_at',
        'students.name as student_name',
        'students.id as student_id',
        'multi_market_outcomes.label as outcome_label',
        'multi_market_outcomes.id as outcome_id'
      )
      .orderBy('multi_market_positions.created_at', 'desc');

    const totalVolume = positions.reduce((sum, p) => sum + p.amount, 0);
    const uniqueTraders = [...new Set(positions.map(p => p.student_id))].length;
    const totalPositions = positions.length;
    const totalPayout = positions.reduce((sum, p) => sum + (p.payout || 0), 0);

    const outcomeBreakdown = market.outcomes.map(o => {
      const outPositions = positions.filter(p => p.outcome_id === o.id);
      return {
        id: o.id,
        label: o.label,
        price: o.price,
        volume: outPositions.reduce((sum, p) => sum + p.amount, 0),
        positions: outPositions.length,
        traders: [...new Set(outPositions.map(p => p.student_id))].length,
      };
    });

    const recentPositions = positions.slice(0, 20).map(p => ({
      student_name: p.student_name,
      outcome_label: p.outcome_label,
      amount: p.amount,
      shares: p.shares,
      entry_price: p.entry_price,
      payout: p.payout,
      created_at: p.created_at,
    }));

    res.json({
      market: {
        id: market.id,
        title: market.title,
        status: market.status,
        category: market.category,
        liquidity_b: market.liquidity_b,
        created_at: market.created_at,
        resolved_at: market.resolved_at,
        closes_at: market.closes_at,
        participant_count: market.participant_count,
        winning_outcome_id: market.winning_outcome_id,
      },
      summary: {
        total_volume: totalVolume,
        unique_traders: uniqueTraders,
        total_positions: totalPositions,
        total_payout: totalPayout,
        avg_position_size: totalPositions > 0 ? Math.round(totalVolume / totalPositions) : 0,
      },
      outcomes: outcomeBreakdown,
      recent_positions: recentPositions,
    });
  } catch (err) { next(err); }
});

router.post('/:id/report', authenticateStudent, async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5 || reason.trim().length > 500) {
      throw new ValidationError('Reason must be 5-500 characters');
    }
    const market = await db('multi_markets').where({ id: req.params.id }).first();
    if (!market) throw new ValidationError('Market not found');
    if (!market.created_by) throw new ValidationError('Cannot report admin-created markets');

    await db('market_reports')
      .insert({
        market_id: req.params.id,
        student_id: req.student.id,
        reason: reason.trim(),
      })
      .onConflict(['market_id', 'student_id'])
      .ignore();

    res.json({ reported: true });
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

router.get('/positions/:positionId/public', async (req, res, next) => {
  try {
    const position = await db('multi_market_positions')
      .where({ 'multi_market_positions.id': req.params.positionId })
      .join('multi_markets', 'multi_markets.id', 'multi_market_positions.market_id')
      .join('multi_market_outcomes', 'multi_market_outcomes.id', 'multi_market_positions.outcome_id')
      .join('students', 'students.id', 'multi_market_positions.student_id')
      .select(
        'multi_market_positions.id as position_id',
        'multi_market_positions.amount',
        'multi_market_positions.entry_price',
        'multi_market_positions.shares',
        'multi_market_positions.created_at',
        'multi_markets.title as market_title',
        'multi_markets.id as market_id',
        'multi_market_outcomes.label as outcome_label',
        'students.username'
      )
      .first();

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const potentialPayout = position.amount > 0
      ? Math.floor(position.amount / position.entry_price)
      : 0;

    res.json({
      positionId: position.position_id,
      marketId: position.market_id,
      marketTitle: position.market_title,
      outcomeLabel: position.outcome_label,
      probability: position.entry_price,
      amount: position.amount,
      potentialPayout,
      username: position.username || 'user',
      timestamp: position.created_at,
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

    const market = await db('multi_markets').where({ id: req.params.id }).first();
    if (market && market.created_by && market.created_by === req.student.id) {
      throw new ValidationError('You cannot predict on your own market');
    }
    if (market && market.closes_at && new Date() > new Date(market.closes_at)) {
      throw new ValidationError('Betting is closed for this market');
    }

    const result = await multiMarkets.buyPosition(req.params.id, outcomeId, req.student.id, amount);

    const io = req.app.get('io');
    if (io) {
      const marketWithOdds = await multiMarkets.getMarketWithOdds(req.params.id);
      const outcome = marketWithOdds.outcomes.find(o => o.id === outcomeId);
      io.emit('odds:update', { marketId: marketWithOdds.id, outcomes: marketWithOdds.outcomes.map(o => ({ id: o.id, price: o.price })) });
      const student = await db('students').where({ id: req.student.id }).first();
      if (!student.is_system) {
        io.emit('prediction:placed', { marketId: marketWithOdds.id, outcomeLabel: outcome ? outcome.label : '', amount });
      }
      io.to(`student:${req.student.id}`).emit('balance:update', { studentId: req.student.id, balance: student.points_balance });
    }

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/creator-resolve', authenticateStudent, async (req, res, next) => {
  try {
    const { outcomeId } = req.body;
    if (!outcomeId) throw new ValidationError('outcomeId is required');
    const result = await multiMarkets.resolveUserMarket(req.params.id, outcomeId, req.student.id);

    const io = req.app.get('io');
    const outcome = await db('multi_market_outcomes').where({ id: outcomeId }).first();
    if (io) {
      io.emit('market:resolved', { marketId: req.params.id, winnerLabel: outcome?.label || '', winnerId: outcomeId });
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
    const outcome = await db('multi_market_outcomes').where({ id: outcomeId }).first();
    if (io) {
      io.emit('market:resolved', { marketId: req.params.id, winnerLabel: outcome?.label || '', winnerId: outcomeId });
    }

    const { notifyMarketResolution, notifyReferralWins } = require('../notifications/whatsapp');
    notifyMarketResolution(req.params.id, outcome?.label || '').catch(() => {});
    notifyReferralWins(req.params.id).catch(() => {});

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/admin/test-win-image', authenticate, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) throw new ValidationError('phone is required');
    const { generateWinImage } = require('../../utils/generateWinImage');
    const { sendWhatsAppImage } = require('../notifications/whatsapp');
    const imageBuffer = generateWinImage({
      marketTitle: 'Who will win the Engineering vs Science match?',
      outcomeLabel: 'Engineering',
      payout: 150,
      amountSpent: 50,
      entryPrice: 0.33,
      referralCode: 'TEST1234',
    });
    const caption = 'You won on IroyinMarket!\n\n"Who will win the Engineering vs Science match?"\nYour pick: Engineering\nPayout: +150 pts (3.0x return)\n\nOpen app: https://iroyinmarket.com/?ref=TEST1234';
    const sent = await sendWhatsAppImage(phone, imageBuffer, caption);
    res.json({ sent });
  } catch (err) { next(err); }
});

module.exports = router;
