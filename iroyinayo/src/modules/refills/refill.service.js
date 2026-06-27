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

module.exports = { getMondayInWAT, issuePendingRefills };
