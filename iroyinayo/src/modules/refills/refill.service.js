const db = require('../../config/database');

const MAX_ATTEMPTS_PER_WEEK = 3;

function getMondayInWAT(now) {
  const ref = now || new Date();
  // Shift the UTC timestamp by +1h to get WAT wall-clock time.
  const wat = new Date(ref.getTime() + 60 * 60 * 1000);
  // getUTCDay() now reflects the WAT day-of-week because we shifted UTC by WAT offset.
  const dayOfWeek = wat.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon -> 0, Tue -> 1, ..., Sun -> 6
  const monday = new Date(wat);
  monday.setUTCDate(wat.getUTCDate() - daysSinceMonday);
  // Format as YYYY-MM-DD using the WAT-shifted date components.
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rollAmount() {
  return 50 + Math.floor(Math.random() * 51);
}

async function issuePendingRefills() {
  const monday = getMondayInWAT();

  // Find all students meeting the base criteria
  const allStudents = await db('students')
    .where({ is_banned: false, points_balance: 0 })
    .select('id');

  if (allStudents.length === 0) {
    return { issued: 0 };
  }

  const studentIds = allStudents.map(s => s.id);

  // Batch query 1: Find all students with unclaimed refills
  const unclaimedRows = await db('pending_refills')
    .whereIn('student_id', studentIds)
    .whereRaw('claimed_at IS NULL')
    .select('student_id');

  const unclaimedSet = new Set(unclaimedRows.map(r => r.student_id));

  // Batch query 2: Find all claimed refills this week for these students
  const claimedRows = await db('pending_refills')
    .whereIn('student_id', studentIds)
    .where({ week_starting: monday })
    .whereRaw('claimed_at IS NOT NULL')
    .select('student_id');

  // Count claimed refills per student in JS
  const claimedMap = new Map();
  for (const row of claimedRows) {
    claimedMap.set(row.student_id, (claimedMap.get(row.student_id) || 0) + 1);
  }

  // Filter eligible students in-memory
  const eligible = allStudents.filter(s => {
    if (unclaimedSet.has(s.id)) return false;
    if ((claimedMap.get(s.id) || 0) >= MAX_ATTEMPTS_PER_WEEK) return false;
    return true;
  });

  // Issue refills for eligible students
  let issued = 0;

  for (const student of eligible) {
    try {
      await db('pending_refills').insert({
        student_id: student.id,
        amount: rollAmount(),
        week_starting: monday,
      });
      issued += 1;
    } catch (err) {
      // Partial unique index can reject a concurrent double-issue; that's fine.
      if (err.code !== '23505') {
        console.error('[refill] insert failed for student', student.id, err.message);
      }
    }
  }

  return { issued };
}

const MAX_POINTS_BALANCE = 2000;

async function getPending({ studentId }) {
  const monday = getMondayInWAT();
  const pendingRow = await db('pending_refills')
    .where({ student_id: studentId, claimed_at: null })
    .orderBy('issued_at', 'desc')
    .first();

  const claimedThisWeek = await db('pending_refills')
    .where({ student_id: studentId, week_starting: monday })
    .whereNotNull('claimed_at')
    .count('id as count')
    .first();

  const count = parseInt(claimedThisWeek?.count || 0, 10);
  return {
    pending: pendingRow ? { id: pendingRow.id, amount: pendingRow.amount } : null,
    refillsRemaining: Math.max(0, 3 - count),
  };
}

async function claim({ studentId, refillId }) {
  return db.transaction(async (trx) => {
    const row = await trx('pending_refills')
      .where({ id: refillId, student_id: studentId })
      .forUpdate()
      .first();

    if (!row || row.claimed_at) {
      return { ok: false, code: 'ALREADY_CLAIMED' };
    }

    const monday = getMondayInWAT();
    const claimedThisWeekRow = await trx('pending_refills')
      .where({ student_id: studentId, week_starting: monday })
      .whereNotNull('claimed_at')
      .count('id as count')
      .first();
    const claimedThisWeek = parseInt(claimedThisWeekRow?.count || 0, 10);

    if (claimedThisWeek >= 3) {
      // Consume the row so a stuck client doesn't retry forever.
      await trx('pending_refills').where({ id: refillId }).update({ claimed_at: new Date() });
      return { ok: false, code: 'WEEKLY_CAP_REACHED' };
    }

    const student = await trx('students').where({ id: studentId }).forUpdate().first();
    const oldBalance = student?.points_balance || 0;
    const credited = Math.min(row.amount, MAX_POINTS_BALANCE - oldBalance);

    await trx('point_transactions').insert({
      student_id: studentId,
      amount: credited,
      type: 'daily_refill',
      description: 'Daily refill claimed',
    });

    await trx('students').where({ id: studentId }).increment('points_balance', credited);
    await trx('pending_refills').where({ id: refillId }).update({ claimed_at: new Date() });

    return { ok: true, amount: credited, newBalance: oldBalance + credited };
  });
}

module.exports = { getMondayInWAT, issuePendingRefills, getPending, claim };
