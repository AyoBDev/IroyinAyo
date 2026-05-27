const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.use(authenticate);

router.get('/performance', async (req, res, next) => {
  try {
    const ambassadors = await db('students')
      .where({ is_ambassador: true })
      .select('id', 'name', 'phone_number', 'markets_created', 'points_balance', 'created_at');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const performance = await Promise.all(ambassadors.map(async (amb) => {
      const weeklyReferrals = await db('students')
        .where({ referred_by: amb.id })
        .where('created_at', '>', weekAgo)
        .count('id as count')
        .first();

      const totalReferrals = await db('students')
        .where({ referred_by: amb.id })
        .count('id as count')
        .first();

      const weeklyMarkets = await db('point_transactions')
        .where({ student_id: amb.id, type: 'ambassador' })
        .where('created_at', '>', weekAgo)
        .count('id as count')
        .first();

      const isActiveThisWeek = (parseInt(weeklyReferrals?.count || 0, 10) >= 5)
        || (parseInt(weeklyMarkets?.count || 0, 10) >= 2);

      return {
        ...amb,
        weekly_referrals: parseInt(weeklyReferrals?.count || 0, 10),
        total_referrals: parseInt(totalReferrals?.count || 0, 10),
        weekly_markets_created: parseInt(weeklyMarkets?.count || 0, 10),
        is_active_this_week: isActiveThisWeek,
      };
    }));

    const summary = {
      total_ambassadors: ambassadors.length,
      active_this_week: performance.filter(a => a.is_active_this_week).length,
      total_referrals_this_week: performance.reduce((s, a) => s + a.weekly_referrals, 0),
      total_markets_this_week: performance.reduce((s, a) => s + a.weekly_markets_created, 0),
    };

    res.json({ summary, ambassadors: performance });
  } catch (err) { next(err); }
});

router.post('/:studentId/promote', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await db('students').where({ id: studentId }).first();
    if (!student) throw new ValidationError('Student not found');

    await db('students').where({ id: studentId }).update({ is_ambassador: true });
    res.json({ success: true, name: student.name });
  } catch (err) { next(err); }
});

router.post('/:studentId/demote', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    await db('students').where({ id: studentId }).update({ is_ambassador: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
