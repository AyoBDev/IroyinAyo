const express = require('express');
const router = express.Router();
const service = require('./students.service');
const { validateRegister, validateUpdateProfile, validateUpdateInterests } = require('./students.validation');
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

router.post('/', async (req, res, next) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    const student = await service.register(req.body);
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const student = await service.getById(req.params.id);
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const errors = validateUpdateProfile(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    const student = await service.updateProfile(req.params.id, req.body);
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/interests', async (req, res, next) => {
  try {
    const errors = validateUpdateInterests(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    const student = await service.updateInterests(req.params.id, req.body.interests);
    res.json(student);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
