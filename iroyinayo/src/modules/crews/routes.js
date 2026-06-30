const express = require('express');
const router = express.Router();
const crewsService = require('./service');
const poolsService = require('./pools.service');
const resolution = require('./resolution.service');
const { requireSupabaseUser: authenticateStudent } = require('../../middleware/requireSupabaseUser');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/adminRole');
const db = require('../../config/database');

function handleErr(err, res, next) {
  if (err && err.code && err.userMessage) {
    // Top-level fields match the existing apiFetch parser shape (err.error, err.code).
    // The nested `error` object preserves the spec's documented response shape for
    // future clients that read it.
    return res.status(err.status || 400).json({
      error: err.userMessage,
      code: err.code,
      userMessage: err.userMessage,
      message: err.message,
      retryable: false,
    });
  }
  return next(err);
}

router.post('/', authenticateStudent, async (req, res, next) => {
  try {
    const result = await crewsService.createCrew(req.body.name, req.student.id);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.get('/', authenticateStudent, async (req, res, next) => {
  try {
    const crews = await crewsService.listCrewsForStudent(req.student.id);
    res.json(crews);
  } catch (e) { handleErr(e, res, next); }
});

router.get('/:id', authenticateStudent, async (req, res, next) => {
  try {
    const detail = await crewsService.getCrewWithMembers(req.params.id);
    const pools = await poolsService.listPoolsForCrew(req.params.id);
    res.json({ ...detail, pools });
  } catch (e) { handleErr(e, res, next); }
});

router.post('/:id/leave', authenticateStudent, async (req, res, next) => {
  try {
    await crewsService.leaveCrew(req.params.id, req.student.id);
    res.json({ ok: true });
  } catch (e) { handleErr(e, res, next); }
});

router.post('/:id/boot/:memberId', authenticateStudent, async (req, res, next) => {
  try {
    await crewsService.bootMember(req.params.id, req.student.id, req.params.memberId);
    res.json({ ok: true });
  } catch (e) { handleErr(e, res, next); }
});

router.post('/:id/rotate-invite', authenticateStudent, async (req, res, next) => {
  try {
    const result = await crewsService.rotateInviteToken(req.params.id, req.student.id);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

// Returns the current active invite token (creator only). Use this when
// opening the invite sheet so we don't rotate the token every time.
router.get('/:id/invite', authenticateStudent, async (req, res, next) => {
  try {
    const result = await crewsService.getCurrentInviteToken(req.params.id, req.student.id);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/:id/delete', authenticateStudent, async (req, res, next) => {
  try {
    await crewsService.deleteCrew(req.params.id, req.student.id);
    res.json({ ok: true });
  } catch (e) { handleErr(e, res, next); }
});

// Invite preview is unauthenticated
router.get('/invites/:token/preview', async (req, res, next) => {
  try {
    const preview = await crewsService.previewByToken(req.params.token);
    res.json(preview);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/invites/:token/join', authenticateStudent, async (req, res, next) => {
  try {
    const result = await crewsService.joinCrewByToken(req.params.token, req.student.id);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/:crewId/pools', authenticateStudent, async (req, res, next) => {
  try {
    const pool = await poolsService.createPool(req.params.crewId, req.student.id, req.body);
    res.json({ pool });
  } catch (e) { handleErr(e, res, next); }
});

router.get('/pools/:poolId', authenticateStudent, async (req, res, next) => {
  try {
    const detail = await poolsService.getPoolDetail(req.params.poolId, req.student.id);
    res.json(detail);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/pools/:poolId/predict', authenticateStudent, async (req, res, next) => {
  try {
    const result = await poolsService.predictInPool(req.params.poolId, { studentId: req.student.id }, req.body.outcome);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/pools/:poolId/report-result', authenticateStudent, async (req, res, next) => {
  try {
    const result = await resolution.creatorReportResult(req.params.poolId, req.student.id, req.body.outcome);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/pools/:poolId/dispute', authenticateStudent, async (req, res, next) => {
  try {
    await resolution.raiseDispute(req.params.poolId, req.student.id, req.body.reason || '');
    res.json({ ok: true });
  } catch (e) { handleErr(e, res, next); }
});

router.post('/admin/pools/:poolId/resolve', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await resolution.adminOverrideResolution(req.params.poolId, req.admin.id, req.body.outcome, req.body.note || null);
    res.json(result);
  } catch (e) { handleErr(e, res, next); }
});

router.post('/realmoney-waitlist', authenticateStudent, async (req, res, next) => {
  try {
    await db('realmoney_waitlist').insert({ student_id: req.student.id, source_context: req.body.source || 'unknown' })
      .onConflict('student_id').ignore();
    res.json({ ok: true });
  } catch (e) { handleErr(e, res, next); }
});

// Public-event picker for the Crews "Public match" tab. Reads the same
// multi_markets feed that the Markets page renders, so users see one list of
// real-world events to pool on. Endpoint name preserved as `/fixtures` for
// frontend backwards-compat — the response shape changed (id + title +
// closes_at) and CreatePoolModal now consumes it accordingly.
router.get('/fixtures', authenticateStudent, async (req, res, next) => {
  try {
    const markets = await db('multi_markets')
      .where({ status: 'open' })
      .orderBy('is_featured', 'desc')
      .orderBy('created_at', 'desc')
      .select('id', 'title', 'status', 'created_at', 'closes_at');
    res.json(markets);
  } catch (e) { handleErr(e, res, next); }
});

module.exports = router;
