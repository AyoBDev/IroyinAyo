const express = require('express');
const router = express.Router();
const service = require('./content.service');
const aiService = require('./content.ai');
const { validateCreateContent } = require('./content.validation');
const { authenticate } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/rateLimiter');
const { ValidationError } = require('../../utils/errors');

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await service.listAll({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const errors = validateCreateContent(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    const content = await service.create(req.body);
    res.status(201).json(content);
  } catch (err) {
    next(err);
  }
});

router.post('/generate', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const { category } = req.body;
    if (category) {
      const content = await aiService.generateContent(category);
      res.status(201).json(content);
    } else {
      const results = await aiService.generateDailyDigest();
      res.status(201).json(results);
    }
  } catch (err) {
    next(err);
  }
});

router.get('/pending', authenticate, async (req, res, next) => {
  try {
    const items = await service.listPendingApproval();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/feed/:studentId', async (req, res, next) => {
  try {
    const feed = await service.getFeedForStudent(req.params.studentId);
    res.json(feed);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const content = await service.getById(req.params.id);
    res.json(content);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const content = await service.publish(req.params.id);
    res.json(content);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', authenticate, async (req, res, next) => {
  try {
    const content = await service.approve(req.params.id);
    res.json(content);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
