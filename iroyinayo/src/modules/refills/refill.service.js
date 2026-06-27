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

  let issued = 0;

  for (const student of allStudents) {
    // Check for unclaimed refills
    const unclaimedRefill = await db('pending_refills')
      .where({ student_id: student.id })
      .whereRaw('claimed_at IS NULL')
      .first();

    if (unclaimedRefill) {
      continue; // Skip - has an unclaimed refill
    }

    // Check claimed refills this week
    const claimedThisWeek = await db('pending_refills')
      .where({ student_id: student.id, week_starting: monday })
      .whereRaw('claimed_at IS NOT NULL')
      .count('* as count');

    const claimedCount = parseInt(claimedThisWeek[0].count, 10);
    if (claimedCount >= MAX_ATTEMPTS_PER_WEEK) {
      continue; // Skip - already at weekly limit
    }

    // Student is eligible - issue a refill
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
