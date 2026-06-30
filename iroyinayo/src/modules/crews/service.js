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

async function createCrew(name, creatorStudentId) {
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
    throw err('VALIDATION', 'Invalid name', 'Crew name must be 1–60 characters.');
  }
  return db.transaction(async (trx) => {
    const [crew] = await trx('crews').insert({ name: name.trim(), created_by: creatorStudentId }).returning('*');
    await trx('crew_members').insert({ crew_id: crew.id, student_id: creatorStudentId, role: 'creator' });
    const token = generateToken();
    await trx('crew_invites').insert({ token, crew_id: crew.id });
    return { crew, inviteToken: token };
  });
}

async function previewByToken(token) {
  const invite = await db('crew_invites').where({ token }).first();
  if (!invite) throw err('INVITE_INVALID', 'Token not found', 'This invite link doesn\'t work. Ask your friend for a new one.', 404);
  if (invite.revoked_at) throw err('INVITE_REVOKED', 'Token revoked', 'This invite link has been replaced. Ask for a new one.', 410);
  const crew = await db('crews').where({ id: invite.crew_id }).whereNull('deleted_at').first();
  if (!crew) throw err('INVITE_INVALID', 'Crew gone', 'This crew no longer exists.', 404);
  const { count } = await db('crew_members').where({ crew_id: crew.id }).count('* as count').first();
  const memberCount = parseInt(count, 10);
  return { crewId: crew.id, crewName: crew.name, memberCount, isFull: memberCount >= MAX_MEMBERS };
}

async function joinCrewByToken(token, studentId) {
  return db.transaction(async (trx) => {
    const invite = await trx('crew_invites').where({ token }).first();
    if (!invite) throw err('INVITE_INVALID', 'Token not found', 'This invite link doesn\'t work.', 404);
    if (invite.revoked_at) throw err('INVITE_REVOKED', 'Token revoked', 'This invite link has been replaced.', 410);

    const crew = await trx('crews').where({ id: invite.crew_id }).whereNull('deleted_at').forUpdate().first();
    if (!crew) throw err('INVITE_INVALID', 'Crew gone', 'This crew no longer exists.', 404);

    const existing = await trx('crew_members').where({ crew_id: crew.id, student_id: studentId }).first();
    if (existing) throw err('ALREADY_MEMBER', 'Already in crew', 'You\'re already in this crew.', 409);

    const { count } = await trx('crew_members').where({ crew_id: crew.id }).count('* as count').first();
    if (parseInt(count, 10) >= MAX_MEMBERS) throw err('CREW_FULL', 'Crew full', 'This crew is full.', 409);

    await trx('crew_members').insert({ crew_id: crew.id, student_id: studentId, role: 'member' });
    return { crew };
  });
}

async function rotateInviteToken(crewId, callerStudentId) {
  const member = await db('crew_members').where({ crew_id: crewId, student_id: callerStudentId, role: 'creator' }).first();
  if (!member) throw err('NOT_CREATOR', 'Not creator', 'Only the crew creator can do that.', 403);
  return db.transaction(async (trx) => {
    await trx('crew_invites').where({ crew_id: crewId }).whereNull('revoked_at').update({ revoked_at: trx.fn.now() });
    const newToken = generateToken();
    await trx('crew_invites').insert({ token: newToken, crew_id: crewId });
    return { newToken };
  });
}

async function leaveCrew(crewId, studentId) {
  return db.transaction(async (trx) => {
    const member = await trx('crew_members').where({ crew_id: crewId, student_id: studentId }).forUpdate().first();
    if (!member) throw err('NOT_MEMBER', 'Not member', 'You\'re not in this crew.', 404);
    if (member.role === 'creator') throw err('CREATOR_CANNOT_LEAVE', 'Creator can\'t leave', 'You can\'t leave your own crew. Delete it instead.', 409);
    await trx('crew_members').where({ crew_id: crewId, student_id: studentId }).del();
  });
}

async function bootMember(crewId, callerStudentId, targetStudentId) {
  if (callerStudentId === targetStudentId) throw err('CANNOT_BOOT_SELF', 'Cannot boot self', 'You can\'t boot yourself. Use leave instead.', 400);
  return db.transaction(async (trx) => {
    const caller = await trx('crew_members').where({ crew_id: crewId, student_id: callerStudentId, role: 'creator' }).forUpdate().first();
    if (!caller) throw err('NOT_CREATOR', 'Not creator', 'Only the crew creator can do that.', 403);
    const target = await trx('crew_members').where({ crew_id: crewId, student_id: targetStudentId }).forUpdate().first();
    if (!target) throw err('NOT_MEMBER', 'Target not in crew', 'That user is not in this crew.', 404);
    await trx('crew_members').where({ crew_id: crewId, student_id: targetStudentId }).del();
  });
}

async function listCrewsForStudent(studentId) {
  const rows = await db('crews')
    .join('crew_members', 'crews.id', 'crew_members.crew_id')
    .where('crew_members.student_id', studentId)
    .whereNull('crews.deleted_at')
    .select('crews.id', 'crews.name')
    .orderBy('crews.created_at', 'desc');

  const enriched = await Promise.all(rows.map(async (c) => {
    const { count: memberCount } = await db('crew_members').where({ crew_id: c.id }).count('* as count').first();
    const { count: activePoolCount } = await db('crew_pools').where({ crew_id: c.id, status: 'open' }).count('* as count').first();
    return { id: c.id, name: c.name, memberCount: parseInt(memberCount, 10), activePoolCount: parseInt(activePoolCount, 10) };
  }));
  return enriched;
}

async function getCrewWithMembers(crewId) {
  const crew = await db('crews').where({ id: crewId }).whereNull('deleted_at').first();
  if (!crew) throw err('NOT_FOUND', 'No crew', 'Crew not found.', 404);
  const members = await db('crew_members')
    .join('students', 'students.id', 'crew_members.student_id')
    .where('crew_members.crew_id', crewId)
    .select('students.id', 'students.name', 'crew_members.role', 'crew_members.joined_at');
  return { crew, members };
}

async function deleteCrew(crewId, callerStudentId) {
  const member = await db('crew_members').where({ crew_id: crewId, student_id: callerStudentId, role: 'creator' }).first();
  if (!member) throw err('NOT_CREATOR', 'Not creator', 'Only the crew creator can delete the crew.', 403);
  return db.transaction(async (trx) => {
    // Refund locked stakes from any open pool
    const openPools = await trx('crew_pools').where({ crew_id: crewId }).whereIn('status', ['open', 'closed', 'awaiting_dispute_window', 'disputed']);
    for (const pool of openPools) {
      const preds = await trx('crew_pool_predictions').where({ pool_id: pool.id }).whereNotNull('student_id');
      for (const p of preds) {
        await trx('students').where({ id: p.student_id }).increment('points_balance', p.points_locked);
      }
    }
    await trx('crews').where({ id: crewId }).update({ deleted_at: trx.fn.now() });
  });
}

module.exports = {
  MAX_MEMBERS,
  createCrew,
  previewByToken,
  joinCrewByToken,
  rotateInviteToken,
  leaveCrew,
  bootMember,
  listCrewsForStudent,
  getCrewWithMembers,
  deleteCrew,
};
