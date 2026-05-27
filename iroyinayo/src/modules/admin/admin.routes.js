const express = require('express');
const router = express.Router();
const service = require('./admin.service');
const { validateRegister, validateLogin } = require('./admin.validation');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const { authLimiter } = require('../../middleware/rateLimiter');
const { ValidationError } = require('../../utils/errors');

router.post('/register', authLimiter, authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.status(201).json(await service.register(req.body));
  } catch (err) { next(err); }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const errors = validateLogin(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.json(await service.login(req.body.email, req.body.password));
  } catch (err) { next(err); }
});

router.get('/analytics', authenticate, async (req, res, next) => {
  try { res.json(await service.getAnalytics()); } catch (err) { next(err); }
});

router.get('/dashboard-kpis', authenticate, async (req, res, next) => {
  try { res.json(await service.getDashboardKPIs()); } catch (err) { next(err); }
});

router.post('/students/:id/ban', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try { res.json(await service.banStudent(req.params.id)); } catch (err) { next(err); }
});

router.post('/students/:id/unban', authenticate, requireRole('super_admin', 'moderator'), async (req, res, next) => {
  try { res.json(await service.unbanStudent(req.params.id)); } catch (err) { next(err); }
});

module.exports = router;
