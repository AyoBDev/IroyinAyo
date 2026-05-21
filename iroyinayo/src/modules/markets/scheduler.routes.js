const express = require('express');
const router = express.Router();
const scheduler = require('./scheduler.service');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const schedules = await scheduler.listSchedules();
    res.json(schedules);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, outcomes, cronExpression, category, liquidityB } = req.body;
    if (!title || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
      throw new ValidationError('title and at least 2 outcomes required');
    }
    if (!cronExpression) {
      throw new ValidationError('cronExpression required');
    }

    const schedule = await scheduler.createSchedule({
      title,
      outcomes,
      cronExpression,
      category,
      liquidityB,
      createdBy: req.admin?.id || null,
    });
    res.status(201).json(schedule);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updated = await scheduler.updateSchedule(req.params.id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/trigger', async (req, res, next) => {
  try {
    const market = await scheduler.triggerNow(req.params.id);
    res.json(market);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await scheduler.deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
