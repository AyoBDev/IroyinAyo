const db = require('../../config/database');
const { getIO } = require('../../socket');

const DISPUTE_WINDOW_HOURS = 2;
const ABANDONED_POOL_DAYS = 7;

function err(code, message, userMessage, status = 400) {
  const e = new Error(message);
  e.code = code; e.userMessage = userMessage; e.status = status;
  return e;
}

/**
 * Apply payouts for a pool and finalize resolution.
 *
 * Behavior (deferred-payout model):
 *  - 'admin' / 'api' source → payouts applied immediately, pool → 'resolved'.
 *  - 'creator' source → does NOT apply payouts here; only records the
 *    open_window resolution row (see creatorReportResult). Payouts run later
 *    when the dispute window expires (processExpiredDisputeWindows) or are
 *    superseded by admin override.
 *
 * Idempotency: returns { already: true } if the pool is already resolved or
 * has any non-resolvable terminal/in-flight status that prevents payouts.
 */
async function calculateAndApplyPayouts(poolId, winnerOutcome, source, opts = {}) {
  const { resolverId = null, adminId = null, adminNote = null, trx: externalTrx = null, skipResolutionInsert = false } = opts;

  async function body(trx) {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    // Idempotency: if pool is already resolved, return early
    if (pool.status === 'resolved') {
      return { paid: 0, perWinner: 0, platformAbsorbed: 0, already: true, crewId: pool.crew_id };
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

    if (!skipResolutionInsert) {
      await trx('crew_pool_resolutions').insert({
        pool_id: poolId,
        source,
        resolver_id: resolverId,
        admin_id: adminId,
        winner_outcome: winnerOutcome,
        dispute_status: 'resolved',
        dispute_window_ends_at: null,
        admin_note: adminNote,
      });
    }

    await trx('crew_pools').where({ id: poolId }).update({ status: 'resolved', winner_outcome: winnerOutcome });

    return { paid: perWinner * winners.length, perWinner, platformAbsorbed, newStatus: 'resolved', crewId: pool.crew_id };
  }

  const result = externalTrx ? await body(externalTrx) : await db.transaction(body);

  // Emit socket event after transaction commits, only when status is now 'resolved'
  const io = getIO();
  if (io && result.newStatus === 'resolved') {
    io.to(`crew:${result.crewId}`).emit('crew:pool:resolved', { poolId, winnerOutcome });
  }

  return result;
}

/**
 * Creator-side resolution: records a resolution row with an open dispute
 * window, marks the pool as awaiting_dispute_window. Payouts are NOT applied
 * here; they run when the dispute window expires (or are superseded by admin
 * override). This prevents double-credit on dispute → admin override.
 */
async function creatorReportResult(poolId, creatorId, winnerOutcome) {
  return db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    if (pool.creator_id !== creatorId) throw err('NOT_POOL_CREATOR', 'Not creator', 'Only the pool creator can report the result.', 403);
    if (pool.pool_type !== 'private') throw err('WRONG_RESOLUTION_PATH', 'Auto-resolved', 'This pool resolves automatically.', 400);
    if (pool.status !== 'closed') throw err('POOL_NOT_OPEN', 'Wrong state', 'Pool isn\'t awaiting your report.', 409);

    await trx('crew_pool_resolutions').insert({
      pool_id: poolId,
      source: 'creator',
      resolver_id: creatorId,
      winner_outcome: winnerOutcome,
      dispute_status: 'open_window',
      dispute_window_ends_at: new Date(Date.now() + DISPUTE_WINDOW_HOURS * 3600 * 1000),
    });
    await trx('crew_pools').where({ id: poolId }).update({ status: 'awaiting_dispute_window', winner_outcome: winnerOutcome });

    return { ok: true, status: 'awaiting_dispute_window', windowHours: DISPUTE_WINDOW_HOURS };
  });
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

/**
 * Admin override: replaces any prior creator resolution with an authoritative
 * one. Because creator-report no longer applies payouts (deferred model), this
 * is a clean fresh payout — no claw-back required.
 */
async function adminOverrideResolution(poolId, adminId, winnerOutcome, note) {
  return db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    if (pool.status !== 'disputed') throw err('NOT_DISPUTED', 'Not disputed', 'This pool isn\'t disputed.', 409);

    // Delete the prior open-window resolution row (no payouts to reverse —
    // creator-report didn't credit anyone in the deferred-payout model).
    await trx('crew_pool_resolutions').where({ pool_id: poolId }).del();
    // Reset pool status so calculateAndApplyPayouts's idempotency guard
    // (resolved-only) allows payouts to run.
    await trx('crew_pools').where({ id: poolId }).update({ status: 'closed' });

    return calculateAndApplyPayouts(poolId, winnerOutcome, 'admin', { adminId, adminNote: note, trx });
  });
}

/**
 * Member confirmation fast-path: any non-creator crew member can confirm the
 * creator's reported outcome, which immediately triggers payout. This bypasses
 * waiting for the full dispute window.
 */
async function confirmResolution(poolId, studentId) {
  return db.transaction(async (trx) => {
    const pool = await trx('crew_pools').where({ id: poolId }).forUpdate().first();
    if (!pool) throw err('POOL_NOT_FOUND', 'No pool', 'Pool not found.', 404);
    if (pool.status !== 'awaiting_dispute_window') {
      throw err('POOL_NOT_OPEN', 'Wrong state', 'This pool isn\'t awaiting confirmation.', 409);
    }
    if (pool.creator_id === studentId) {
      throw err('CREATOR_CANNOT_CONFIRM', 'Creator cannot confirm own report', 'You reported this result — someone else needs to confirm.', 403);
    }
    const member = await trx('crew_members').where({ crew_id: pool.crew_id, student_id: studentId }).first();
    if (!member) throw err('NOT_CREW_MEMBER', 'Not a member', 'You are not in this crew.', 403);

    const res = await trx('crew_pool_resolutions').where({ pool_id: poolId }).first();
    if (!res) throw err('POOL_NOT_FOUND', 'No resolution', 'No resolution to confirm.', 404);

    const confirmations = Array.isArray(res.confirmations) ? res.confirmations : [];
    if (confirmations.includes(studentId)) {
      throw err('ALREADY_CONFIRMED', 'Already confirmed', 'You have already confirmed this result.', 409);
    }
    confirmations.push(studentId);

    // Fast-path: any confirmation from a non-creator member triggers immediate payout.
    await trx('crew_pool_resolutions').where({ pool_id: poolId }).update({
      confirmations: JSON.stringify(confirmations),
    });

    // Apply payouts inside the same transaction. Delegate to calculateAndApplyPayouts with trx.
    const winnerOutcome = res.winner_outcome;
    return calculateAndApplyPayouts(poolId, winnerOutcome, 'creator', {
      resolverId: pool.creator_id,
      trx,
      skipResolutionInsert: true,
    });
  });
}

/**
 * Cron entry point. Finds resolutions whose creator-reported dispute window
 * has lapsed without a dispute and applies payouts now. This is where pool
 * funds actually move for the creator-report path.
 */
async function processExpiredDisputeWindows() {
  const expired = await db('crew_pool_resolutions')
    .where('dispute_status', 'open_window')
    .where('dispute_window_ends_at', '<=', db.fn.now());
  let resolved = 0;
  for (const res of expired) {
    try {
      await db.transaction(async (trx) => {
        const pool = await trx('crew_pools').where({ id: res.pool_id }).forUpdate().first();
        if (!pool || pool.status === 'resolved') return;
        if (pool.status !== 'awaiting_dispute_window') return; // disputed → admin handles it

        // Apply payouts in this transaction; suppress a second resolution insert
        // since we already have a creator-report row to keep as the audit trail.
        await calculateAndApplyPayouts(res.pool_id, res.winner_outcome, 'creator', {
          resolverId: res.resolver_id, trx, skipResolutionInsert: true,
        });
        // Flip the resolution row to its final status.
        await trx('crew_pool_resolutions').where({ id: res.id }).update({ dispute_status: 'resolved' });
      });
      resolved++;
    } catch (e) {
      console.error('[crews] processExpiredDisputeWindows pool', res.pool_id, 'failed:', e.message);
    }
  }
  return { resolved };
}

/**
 * Auto-refund abandoned pools: pools that remain 'closed' for 7 days without
 * the creator reporting a result. Returns all stakes to predictors and marks
 * the pool as resolved with winner_outcome='abandoned'.
 */
async function refundAbandonedPools() {
  const cutoff = new Date(Date.now() - ABANDONED_POOL_DAYS * 24 * 3600 * 1000);
  const abandoned = await db('crew_pools')
    .where('status', 'closed')
    .where('pool_type', 'private')
    .where('created_at', '<=', cutoff);

  let refunded = 0;
  for (const pool of abandoned) {
    try {
      await db.transaction(async (trx) => {
        const locked = await trx('crew_pools').where({ id: pool.id }).forUpdate().first();
        if (!locked || locked.status !== 'closed') return; // race check

        const predictions = await trx('crew_pool_predictions')
          .where({ pool_id: pool.id })
          .whereNotNull('student_id');
        for (const p of predictions) {
          if (p.points_locked > 0) {
            await trx('students').where({ id: p.student_id }).increment('points_balance', p.points_locked);
            await trx('crew_pool_predictions').where({ id: p.id }).update({ payout: p.points_locked });
          }
        }
        await trx('crew_pool_resolutions').insert({
          pool_id: pool.id,
          source: 'admin',
          resolver_id: null,
          admin_id: null,
          winner_outcome: 'abandoned',
          dispute_status: 'resolved',
          admin_note: 'Auto-refund: creator did not report within 7 days',
          confirmations: JSON.stringify([]),
        });
        await trx('crew_pools').where({ id: pool.id }).update({ status: 'resolved', winner_outcome: 'abandoned' });
        refunded++;
      });
    } catch (e) {
      console.error(`[crews] refund of abandoned pool ${pool.id} failed:`, e.message);
    }
  }
  return { refunded };
}

module.exports = {
  DISPUTE_WINDOW_HOURS,
  calculateAndApplyPayouts,
  creatorReportResult,
  autoResolvePublicPool,
  raiseDispute,
  confirmResolution,
  adminOverrideResolution,
  processExpiredDisputeWindows,
  refundAbandonedPools,
};
