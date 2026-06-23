const db = require('../../config/database');

async function listRecentBans({ daysBack = 7 } = {}) {
  // Detect whether banned_at column exists
  const hasBannedAt = await db.raw(
    `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='banned_at'`
  );
  const useBannedAt = hasBannedAt.rows.length > 0;
  const timeCol = useBannedAt ? 'banned_at' : 'updated_at';

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  let query = db('students').where({ is_banned: true });
  // Some installations may not have updated_at either; if neither exists, return all banned
  try {
    query = query.where(timeCol, '>=', since);
  } catch (_) { /* no-op */ }

  const items = await query
    .orderBy(timeCol, 'desc')
    .limit(50)
    .select('id', 'name', 'phone_number', useBannedAt ? 'banned_at' : db.raw(`updated_at as banned_at`));

  return { items, total: items.length };
}

module.exports = { listRecentBans };
