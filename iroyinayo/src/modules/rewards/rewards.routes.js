const express = require('express');
const router = express.Router();
const service = require('./rewards.service');
const { validateCreateRewardOption, validateRedeem } = require('./rewards.validation');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.get('/options', async (req, res, next) => {
  try { res.json(await service.listActiveOptions()); } catch (err) { next(err); }
});

router.post('/options', authenticate, async (req, res, next) => {
  try {
    const errors = validateCreateRewardOption(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.status(201).json(await service.createRewardOption(req.body));
  } catch (err) { next(err); }
});

router.post('/redeem', async (req, res, next) => {
  try {
    const errors = validateRedeem(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.json(await service.redeem(req.body.student_id, req.body.reward_option_id));
  } catch (err) { next(err); }
});

router.get('/pending', authenticate, async (req, res, next) => {
  try { res.json(await service.listPendingRedemptions()); } catch (err) { next(err); }
});

router.post('/:id/fulfill', authenticate, async (req, res, next) => {
  try { res.json(await service.fulfillRedemption(req.params.id)); } catch (err) { next(err); }
});

router.get('/student/:studentId', async (req, res, next) => {
  try { res.json(await service.getStudentRedemptions(req.params.studentId)); } catch (err) { next(err); }
});

router.get('/status/:studentId', async (req, res, next) => {
  try { res.json(await service.getRewardStatus(req.params.studentId)); } catch (err) { next(err); }
});

module.exports = router;
