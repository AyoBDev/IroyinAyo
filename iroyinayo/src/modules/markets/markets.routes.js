const express = require('express');
const router = express.Router();
const service = require('./markets.service');
const { validateCreateMarket, validateBuyPosition } = require('./markets.validation');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.get('/', async (req, res, next) => {
  try { res.json(await service.listOpen()); } catch (err) { next(err); }
});

router.get('/all', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(await service.listAll({ page, limit }));
  } catch (err) { next(err); }
});

router.get('/pending', authenticate, async (req, res, next) => {
  try { res.json(await service.listPendingApproval()); } catch (err) { next(err); }
});

router.get('/student/:studentId', async (req, res, next) => {
  try { res.json(await service.getStudentPositions(req.params.studentId)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const errors = validateCreateMarket(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.status(201).json(await service.create(req.body));
  } catch (err) { next(err); }
});

router.post('/:id/buy', async (req, res, next) => {
  try {
    const errors = validateBuyPosition(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.json(await service.buyPosition(req.params.id, req.body.student_id, req.body.side, req.body.amount));
  } catch (err) { next(err); }
});

router.post('/:id/approve', authenticate, async (req, res, next) => {
  try { res.json(await service.approve(req.params.id)); } catch (err) { next(err); }
});

router.post('/:id/resolve', authenticate, async (req, res, next) => {
  try { res.json(await service.resolve(req.params.id, req.body.outcome)); } catch (err) { next(err); }
});

router.post('/:id/sponsor', authenticate, async (req, res, next) => {
  try {
    if (!req.body.amount || req.body.amount <= 0) throw new ValidationError('amount must be a positive number');
    res.json(await service.sponsorMarket(req.params.id, req.body.amount));
  } catch (err) { next(err); }
});

module.exports = router;
