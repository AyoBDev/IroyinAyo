const crypto = require('crypto');
const db = require('../../config/database');

const MAX_MEMBERS = 15;

function err(code, message, userMessage, status = 400) {
  const e = new Error(message);
  e.code = code;
  e.userMessage = userMessage;
  e.status = status;
  return e;
}

function generateToken() {
  return crypto.randomBytes(16).toString('base64url'); // 22 chars
}

async function createCircle(name, creatorStudentId) {
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
    throw err('VALIDATION', 'Invalid name', 'Circle name must be 1–60 characters.');
  }
  return db.transaction(async (trx) => {
    const [circle] = await trx('circles').insert({ name: name.trim(), created_by: creatorStudentId }).returning('*');
    await trx('circle_members').insert({ circle_id: circle.id, student_id: creatorStudentId, role: 'creator' });
    const token = generateToken();
    await trx('circle_invites').insert({ token, circle_id: circle.id });
    return { circle, inviteToken: token };
  });
}

async function previewByToken(token) {
  const invite = await db('circle_invites').where({ token }).first();
  if (!invite) throw err('INVITE_INVALID', 'Token not found', 'This invite link doesn\'t work. Ask your friend for a new one.', 404);
  if (invite.revoked_at) throw err('INVITE_REVOKED', 'Token revoked', 'This invite link has been replaced. Ask for a new one.', 410);
  const circle = await db('circles').where({ id: invite.circle_id }).whereNull('deleted_at').first();
  if (!circle) throw err('INVITE_INVALID', 'Circle gone', 'This circle no longer exists.', 404);
  const { count } = await db('circle_members').where({ circle_id: circle.id }).count('* as count').first();
  const memberCount = parseInt(count, 10);
  return { circleId: circle.id, circleName: circle.name, memberCount, isFull: memberCount >= MAX_MEMBERS };
}

async function joinCircleByToken(token, studentId) {
  return db.transaction(async (trx) => {
    const invite = await trx('circle_invites').where({ token }).first();
    if (!invite) throw err('INVITE_INVALID', 'Token not found', 'This invite link doesn\'t work.', 404);
    if (invite.revoked_at) throw err('INVITE_REVOKED', 'Token revoked', 'This invite link has been replaced.', 410);

    const circle = await trx('circles').where({ id: invite.circle_id }).whereNull('deleted_at').forUpdate().first();
    if (!circle) throw err('INVITE_INVALID', 'Circle gone', 'This circle no longer exists.', 404);

    const existing = await trx('circle_members').where({ circle_id: circle.id, student_id: studentId }).first();
    if (existing) throw err('ALREADY_MEMBER', 'Already in circle', 'You\'re already in this circle.', 409);

    const { count } = await trx('circle_members').where({ circle_id: circle.id }).count('* as count').first();
    if (parseInt(count, 10) >= MAX_MEMBERS) throw err('CIRCLE_FULL', 'Circle full', 'This circle is full.', 409);

    await trx('circle_members').insert({ circle_id: circle.id, student_id: studentId, role: 'member' });
    return { circle };
  });
}

/**
 * Returns the current active (non-revoked) invite token for the circle. Creator
 * only. Used by the invite sheet so opening it doesn't invalidate the link the
 * creator may have already shared. Falls back to issuing a fresh token if none
 * is active (e.g. if all prior invites were revoked).
 */
async function getCurrentInviteToken(circleId, callerStudentId) {
  const member = await db('circle_members').where({ circle_id: circleId, student_id: callerStudentId, role: 'creator' }).first();
  if (!member) throw err('NOT_CREATOR', 'Not creator', 'Only the circle creator can do that.', 403);
  const active = await db('circle_invites')
    .where({ circle_id: circleId })
    .whereNull('revoked_at')
    .orderBy('created_at', 'desc')
    .first();
  if (active) return { token: active.token };
  return db.transaction(async (trx) => {
    const token = generateToken();
    await trx('circle_invites').insert({ token, circle_id: circleId });
    return { token };
  });
}

async function rotateInviteToken(circleId, callerStudentId) {
  const member = await db('circle_members').where({ circle_id: circleId, student_id: callerStudentId, role: 'creator' }).first();
  if (!member) throw err('NOT_CREATOR', 'Not creator', 'Only the circle creator can do that.', 403);
  return db.transaction(async (trx) => {
    await trx('circle_invites').where({ circle_id: circleId }).whereNull('revoked_at').update({ revoked_at: trx.fn.now() });
    const newToken = generateToken();
    await trx('circle_invites').insert({ token: newToken, circle_id: circleId });
    return { newToken };
  });
}

async function leaveCircle(circleId, studentId) {
  return db.transaction(async (trx) => {
    const member = await trx('circle_members').where({ circle_id: circleId, student_id: studentId }).forUpdate().first();
    if (!member) throw err('NOT_MEMBER', 'Not member', 'You\'re not in this circle.', 404);
    if (member.role === 'creator') throw err('CREATOR_CANNOT_LEAVE', 'Creator can\'t leave', 'You can\'t leave your own circle. Delete it instead.', 409);
    await trx('circle_members').where({ circle_id: circleId, student_id: studentId }).del();
  });
}

async function bootMember(circleId, callerStudentId, targetStudentId) {
  if (callerStudentId === targetStudentId) throw err('CANNOT_BOOT_SELF', 'Cannot boot self', 'You can\'t boot yourself. Use leave instead.', 400);
  return db.transaction(async (trx) => {
    const caller = await trx('circle_members').where({ circle_id: circleId, student_id: callerStudentId, role: 'creator' }).forUpdate().first();
    if (!caller) throw err('NOT_CREATOR', 'Not creator', 'Only the circle creator can do that.', 403);
    const target = await trx('circle_members').where({ circle_id: circleId, student_id: targetStudentId }).forUpdate().first();
    if (!target) throw err('NOT_MEMBER', 'Target not in circle', 'That user is not in this circle.', 404);
    await trx('circle_members').where({ circle_id: circleId, student_id: targetStudentId }).del();
  });
}

async function listCirclesForStudent(studentId) {
  const rows = await db('circles')
    .join('circle_members', 'circles.id', 'circle_members.circle_id')
    .where('circle_members.student_id', studentId)
    .whereNull('circles.deleted_at')
    .select('circles.id', 'circles.name')
    .orderBy('circles.created_at', 'desc');

  const enriched = await Promise.all(rows.map(async (c) => {
    const { count: memberCount } = await db('circle_members').where({ circle_id: c.id }).count('* as count').first();
    const { count: activePoolCount } = await db('circle_pools').where({ circle_id: c.id, status: 'open' }).count('* as count').first();
    return { id: c.id, name: c.name, memberCount: parseInt(memberCount, 10), activePoolCount: parseInt(activePoolCount, 10) };
  }));
  return enriched;
}

async function getCircleWithMembers(circleId) {
  const circle = await db('circles').where({ id: circleId }).whereNull('deleted_at').first();
  if (!circle) throw err('NOT_FOUND', 'No circle', 'Circle not found.', 404);
  const members = await db('circle_members')
    .join('students', 'students.id', 'circle_members.student_id')
    .where('circle_members.circle_id', circleId)
    .select('students.id', 'students.name', 'circle_members.role', 'circle_members.joined_at');
  return { circle, members };
}

async function deleteCircle(circleId, callerStudentId) {
  const member = await db('circle_members').where({ circle_id: circleId, student_id: callerStudentId, role: 'creator' }).first();
  if (!member) throw err('NOT_CREATOR', 'Not creator', 'Only the circle creator can delete the circle.', 403);
  return db.transaction(async (trx) => {
    // Refund locked stakes from any open pool
    const openPools = await trx('circle_pools').where({ circle_id: circleId }).whereIn('status', ['open', 'closed', 'awaiting_dispute_window', 'disputed']);
    for (const pool of openPools) {
      const preds = await trx('circle_pool_predictions').where({ pool_id: pool.id }).whereNotNull('student_id');
      for (const p of preds) {
        await trx('students').where({ id: p.student_id }).increment('points_balance', p.points_locked);
      }
    }
    await trx('circles').where({ id: circleId }).update({ deleted_at: trx.fn.now() });
  });
}

/**
 * Returns leaderboard stats for all members of a circle, ranked by net points
 * (sum payout - sum points_locked), then accuracy as tie-breaker.
 *
 * Stats computed from circle_pool_predictions joined with circle_pools:
 * - pools_predicted: count of predictions placed (any pool status)
 * - correct: count where winner_outcome === predicted_outcome AND status='resolved'
 * - accuracy: correct / count_of_resolved_predictions (null if never predicted on resolved pool)
 * - net_points: sum(payout) - sum(points_locked)
 */
async function getLeaderboardForCircle(circleId) {
  const circle = await db('circles').where({ id: circleId }).whereNull('deleted_at').first();
  if (!circle) throw err('NOT_FOUND', 'No circle', 'Circle not found.', 404);

  const members = await db('circle_members')
    .join('students', 'students.id', 'circle_members.student_id')
    .where('circle_members.circle_id', circleId)
    .select('students.id', 'students.name');

  // Fetch all predictions for this circle's pools (only from registered students)
  const predictions = await db('circle_pool_predictions')
    .join('circle_pools', 'circle_pools.id', 'circle_pool_predictions.pool_id')
    .where('circle_pools.circle_id', circleId)
    .whereNotNull('circle_pool_predictions.student_id')
    .select(
      'circle_pool_predictions.student_id',
      'circle_pool_predictions.predicted_outcome',
      'circle_pool_predictions.points_locked',
      'circle_pool_predictions.payout',
      'circle_pools.status',
      'circle_pools.winner_outcome'
    );

  const stats = members.map((member) => {
    const memberPreds = predictions.filter((p) => p.student_id === member.id);
    const pools_predicted = memberPreds.length;
    const resolvedPreds = memberPreds.filter((p) => p.status === 'resolved');
    const correct = resolvedPreds.filter((p) => p.winner_outcome === p.predicted_outcome).length;
    const resolved_count = resolvedPreds.length;
    const accuracy = resolved_count > 0 ? Math.round((correct / resolved_count) * 100) : null;
    const net_points = memberPreds.reduce((sum, p) => sum + p.payout - p.points_locked, 0);

    return {
      student_id: member.id,
      name: member.name,
      pools_predicted,
      correct,
      resolved_count,
      accuracy,
      net_points,
    };
  });

  // Rank by net_points desc, then accuracy desc (nulls last)
  stats.sort((a, b) => {
    if (b.net_points !== a.net_points) return b.net_points - a.net_points;
    if (a.accuracy === null) return 1;
    if (b.accuracy === null) return -1;
    return b.accuracy - a.accuracy;
  });

  return stats;
}

module.exports = {
  MAX_MEMBERS,
  createCircle,
  previewByToken,
  joinCircleByToken,
  getCurrentInviteToken,
  rotateInviteToken,
  leaveCircle,
  bootMember,
  listCirclesForStudent,
  getCircleWithMembers,
  deleteCircle,
  getLeaderboardForCircle,
};
