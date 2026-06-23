const express = require('express');
const { authenticate } = require('../../middleware/auth');
const service = require('./bannedStudents.service');

const router = express.Router();

router.get('/students/banned', authenticate, async (req, res, next) => {
  try {
    const result = await service.listRecentBans();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
