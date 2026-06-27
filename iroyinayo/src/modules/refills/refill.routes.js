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

module.exports = router;
