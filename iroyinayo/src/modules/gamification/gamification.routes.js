const express = require('express');
const router = express.Router();
const service = require('./gamification.service');
const { validateCreateQuiz, validateAnswerQuiz } = require('./gamification.validation');
const { authenticate } = require('../../middleware/auth');
const { ValidationError } = require('../../utils/errors');

router.get('/points/:studentId', async (req, res, next) => {
  try { res.json(await service.getPointsBalance(req.params.studentId)); } catch (err) { next(err); }
});

router.get('/points/:studentId/history', async (req, res, next) => {
  try { res.json(await service.getTransactionHistory(req.params.studentId)); } catch (err) { next(err); }
});

router.get('/leaderboard', async (req, res, next) => {
  try { res.json(await service.getLeaderboard(req.query.period || 'weekly')); } catch (err) { next(err); }
});

router.get('/quizzes', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(await service.listQuizzes({ page, limit }));
  } catch (err) { next(err); }
});

router.post('/quizzes', authenticate, async (req, res, next) => {
  try {
    const errors = validateCreateQuiz(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.status(201).json(await service.createQuiz(req.body));
  } catch (err) { next(err); }
});

router.post('/quizzes/:quizId/answer', async (req, res, next) => {
  try {
    const errors = validateAnswerQuiz(req.body);
    if (errors.length > 0) throw new ValidationError(errors.join(', '));
    res.json(await service.answerQuiz(req.body.student_id, req.params.quizId, req.body.selected_option));
  } catch (err) { next(err); }
});

module.exports = router;
