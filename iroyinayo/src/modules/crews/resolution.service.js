const db = require('../../config/database');

const DISPUTE_WINDOW_HOURS = 24;

function err(code, message, userMessage, status = 400) {
  const e = new Error(message);
  e.code = code; e.userMessage = userMessage; e.status = status;
  return e;
}

async function calculateAndApplyPayouts(poolId, winnerOutcome, source, opts = {}) {
  const { resolverId = null, adminId = null, adminNote = null } = opts;

  return db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    // Idempotency: if payouts already applied, return early
    if (['resolved', 'awaiting_dispute_window', 'disputed'].includes(pool.status)) {
      return { paid: 0, perWinner: 0, platformAbsorbed: 0, already: true };
    }

    const predictions = await trx('crew_pool_predictions').where({ pool_id: poolId }).whereNotNull('student_id');
    const pot = predictions.reduce((sum, p) => sum + p.points_locked, 0);
    const winners = predictions.filter((p) => p.predicted_outcome === winnerOutcome);

    let perWinner = 0;
    let platformAbsorbed = 0;
    if (winners.length === 0) {
      // Refund stakes to every predictor (or no-op if no predictors)
      for (const p of predictions) {
        await trx('crew_pool_predictions').where({ id: p.id }).update({ payout: p.points_locked });
        await trx('students').where({ id: p.student_id }).increment('points_balance', p.points_locked);
      }
      platformAbsorbed = 0;
    } else {
      perWinner = Math.floor(pot / winners.length);
      const totalPaid = perWinner * winners.length;
      platformAbsorbed = pot - totalPaid;
      for (const p of predictions) {
        const payout = (p.predicted_outcome === winnerOutcome) ? perWinner : 0;
        await trx('crew_pool_predictions').where({ id: p.id }).update({ payout });
        if (payout > 0) {
          await trx('students').where({ id: p.student_id }).increment('points_balance', payout);
        }
      }
    }

    await trx('crew_pool_resolutions').insert({
      pool_id: poolId,
      source,
      resolver_id: resolverId,
      admin_id: adminId,
      winner_outcome: winnerOutcome,
      dispute_status: source === 'creator' ? 'open_window' : 'resolved',
      dispute_window_ends_at: source === 'creator' ? new Date(Date.now() + DISPUTE_WINDOW_HOURS * 3600 * 1000) : null,
      admin_note: adminNote,
    });

    const newStatus = source === 'creator' ? 'awaiting_dispute_window' : 'resolved';
    await trx('crew_pools').where({ id: poolId }).update({ status: newStatus, winner_outcome: winnerOutcome });

    return { paid: perWinner * winners.length, perWinner, platformAbsorbed };
  });
}

async function creatorReportResult(poolId, creatorId, winnerOutcome) {
  const pool = await db('crew_pools').where({ id: poolId }).first();
  if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
  if (pool.creator_id !== creatorId) throw err('NOT_POOL_CREATOR', 'Not creator', 'Only the pool creator can report the result.', 403);
  if (pool.pool_type !== 'private') throw err('WRONG_RESOLUTION_PATH', 'Auto-resolved', 'This pool resolves automatically.', 400);
  if (pool.status !== 'closed') throw err('POOL_NOT_OPEN', 'Wrong state', 'Pool isn\'t awaiting your report.', 409);
  return calculateAndApplyPayouts(poolId, winnerOutcome, 'creator', { resolverId: creatorId });
}

async function autoResolvePublicPool(poolId, winnerOutcome) {
  return calculateAndApplyPayouts(poolId, winnerOutcome, 'api');
}

async function raiseDispute(poolId, studentId, reason) {
  return db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    if (pool.status !== 'awaiting_dispute_window') throw err('POOL_NOT_OPEN', 'Wrong state', 'No dispute window for this pool.', 409);
    if (pool.creator_id === studentId) throw err('CREATOR_CANNOT_DISPUTE', 'Creator', 'You can\'t dispute your own report.', 403);
    const member = await trx('crew_members').where({ crew_id: pool.crew_id, student_id: studentId }).first();
    if (!member) throw err('NOT_CREW_MEMBER', 'Not a member', 'You\'re not in this crew.', 403);
    const res = await trx('crew_pool_resolutions').where({ pool_id: poolId }).first();
    if (!res || new Date(res.dispute_window_ends_at).getTime() <= Date.now()) {
      throw err('DISPUTE_WINDOW_CLOSED', 'Window closed', 'The dispute window has closed.', 410);
    }
    await trx('crew_pool_resolutions').where({ pool_id: poolId }).update({ dispute_status: 'disputed', dispute_reason: reason });
    await trx('crew_pools').where({ id: poolId }).update({ status: 'disputed' });
  });
}

async function adminOverrideResolution(poolId, adminId, winnerOutcome, note) {
  const pool = await db('crew_pools').where({ id: poolId }).first();
  if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
  if (pool.status !== 'disputed') throw err('NOT_DISPUTED', 'Not disputed', 'This pool isn\'t disputed.', 409);
  // Mark old resolution void
  await db('crew_pool_resolutions').where({ pool_id: poolId }).update({ dispute_status: 'resolved' });
  // New resolution applied via calculateAndApplyPayouts; but since previous resolution row exists, we need to handle it.
  // Strategy: delete prior resolution row to allow re-insert.
  await db('crew_pool_resolutions').where({ pool_id: poolId }).del();
  await db('crew_pools').where({ id: poolId }).update({ status: 'closed' }); // reset for re-resolution
  return calculateAndApplyPayouts(poolId, winnerOutcome, 'admin', { adminId, adminNote: note });
}

async function processExpiredDisputeWindows() {
  const expired = await db('crew_pool_resolutions')
    .where('dispute_status', 'open_window')
    .where('dispute_window_ends_at', '<=', db.fn.now());
  let resolved = 0;
  for (const res of expired) {
    const pool = await db('crew_pools').where({ id: res.pool_id }).first();
    if (!pool || pool.status === 'resolved') continue;
    // Mark resolution as final and pool as resolved (no second payout — already applied in creatorReport)
    await db('crew_pool_resolutions').where({ id: res.id }).update({ dispute_status: 'resolved' });
    await db('crew_pools').where({ id: res.pool_id }).update({ status: 'resolved' });
    resolved++;
  }
  return { resolved };
}

module.exports = {
  DISPUTE_WINDOW_HOURS,
  calculateAndApplyPayouts,
  creatorReportResult,
  autoResolvePublicPool,
  raiseDispute,
  adminOverrideResolution,
  processExpiredDisputeWindows,
};
