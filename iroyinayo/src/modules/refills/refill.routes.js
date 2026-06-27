const express = require('express');
const router = express.Router();
const { requireSupabaseUser } = require('../../middleware/requireSupabaseUser');
const { getPending, claim } = require('./refill.service');

router.get('/pending-refill', requireSupabaseUser, async (req, res, next) => {
  try {
    const result = await getPending({ studentId: req.student.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/pending-refill/claim', requireSupabaseUser, async (req, res, next) => {
  try {
    const { id } = req.body || {};
    const result = await claim({ studentId: req.student.id, refillId: id });
    if (result.ok) {
      return res.json(result);
    }
    return res.status(400).json({ code: result.code });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
