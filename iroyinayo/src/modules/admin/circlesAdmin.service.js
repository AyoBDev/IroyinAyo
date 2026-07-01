const db = require('../../config/database');

/**
 * Get overview statistics for Circles dashboard
 * @returns {Promise<{circles7d: number, circles30d: number, circlesAll: number, activeCirclesWeek: number, volume7d: number, volume30d: number, disputesCount: number, abandonedCount: number}>}
 */
async function getOverviewStats() {
  const now = new Date();
  const date7d = new Date(now - 7 * 86400 * 1000);
  const date30d = new Date(now - 30 * 86400 * 1000);

  const [
    circles7dRow,
    circles30dRow,
    circlesAllRow,
    activeCirclesRow,
    volume7dRow,
    volume30dRow,
    disputesRow,
    abandonedRow,
  ] = await Promise.all([
    // Circles created 7d
    db('circles')
      .where('created_at', '>=', date7d)
      .whereNull('deleted_at')
      .count('* as c')
      .first(),
    // Circles created 30d
    db('circles')
      .where('created_at', '>=', date30d)
      .whereNull('deleted_at')
      .count('* as c')
      .first(),
    // All circles
    db('circles')
      .whereNull('deleted_at')
      .count('* as c')
      .first(),
    // Active circles this week (≥1 pool created OR ≥1 prediction in last 7d)
    db.raw(`
      SELECT COUNT(DISTINCT c.id) as c
      FROM circles c
      WHERE c.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM circle_pools cp
            WHERE cp.circle_id = c.id AND cp.created_at >= ?
          )
          OR EXISTS (
            SELECT 1 FROM circle_pools cp
            JOIN circle_pool_predictions cpp ON cpp.pool_id = cp.id
            WHERE cp.circle_id = c.id AND cpp.created_at >= ?
          )
        )
    `, [date7d, date7d]),
    // Volume 7d (sum of points_locked)
    db('circle_pool_predictions')
      .join('circle_pools', 'circle_pool_predictions.pool_id', 'circle_pools.id')
      .where('circle_pool_predictions.created_at', '>=', date7d)
      .sum('circle_pool_predictions.points_locked as total')
      .first(),
    // Volume 30d
    db('circle_pool_predictions')
      .join('circle_pools', 'circle_pool_predictions.pool_id', 'circle_pools.id')
      .where('circle_pool_predictions.created_at', '>=', date30d)
      .sum('circle_pool_predictions.points_locked as total')
      .first(),
    // Disputes needing arbitration
    db('circle_pools')
      .where('status', 'disputed')
      .count('* as c')
      .first(),
    // Abandoned candidates (private pools, closed >4 days, no resolution)
    db.raw(`
      SELECT COUNT(*) as c
      FROM circle_pools cp
      WHERE cp.status = 'closed'
        AND cp.pool_type = 'private'
        AND cp.created_at < NOW() - INTERVAL '4 days'
        AND NOT EXISTS (
          SELECT 1 FROM circle_pool_resolutions r WHERE r.pool_id = cp.id
        )
    `),
  ]);

  return {
    circles7d: Number(circles7dRow.c) || 0,
    circles30d: Number(circles30dRow.c) || 0,
    circlesAll: Number(circlesAllRow.c) || 0,
    activeCirclesWeek: Number(activeCirclesRow.rows[0]?.c) || 0,
    volume7d: Number(volume7dRow.total) || 0,
    volume30d: Number(volume30dRow.total) || 0,
    disputesCount: Number(disputesRow.c) || 0,
    abandonedCount: Number(abandonedRow.rows[0]?.c) || 0,
  };
}

/**
 * Get list of disputed pools needing arbitration
 * @returns {Promise<Array<{pool_id: string, circle_id: string, circle_name: string, title: string, creator_name: string, creator_id: string, dispute_reason: string, raised_at: Date, predictions_count: number, total_pot: number}>>}
 */
async function getDisputes() {
  const disputes = await db('circle_pools as cp')
    .select(
      'cp.id as pool_id',
      'cp.circle_id',
      'c.name as circle_name',
      'cp.title',
      's.name as creator_name',
      'cp.creator_id',
      'r.dispute_reason',
      'r.resolved_at as raised_at',
      db.raw('COUNT(DISTINCT cpp.id) as predictions_count'),
      db.raw('SUM(cpp.points_locked) as total_pot')
    )
    .join('circles as c', 'cp.circle_id', 'c.id')
    .join('students as s', 'cp.creator_id', 's.id')
    .leftJoin('circle_pool_resolutions as r', 'cp.id', 'r.pool_id')
    .leftJoin('circle_pool_predictions as cpp', 'cp.id', 'cpp.pool_id')
    .where('cp.status', 'disputed')
    .groupBy('cp.id', 'c.id', 'c.name', 's.name', 'cp.creator_id', 'r.dispute_reason', 'r.resolved_at')
    .orderBy('r.resolved_at', 'desc');

  return disputes.map(d => ({
    pool_id: d.pool_id,
    circle_id: d.circle_id,
    circle_name: d.circle_name,
    title: d.title || '(untitled pool)',
    creator_name: d.creator_name,
    creator_id: d.creator_id,
    dispute_reason: d.dispute_reason || '',
    raised_at: d.raised_at,
    predictions_count: Number(d.predictions_count) || 0,
    total_pot: Number(d.total_pot) || 0,
  }));
}

/**
 * Get abandoned pool candidates (private, closed >4 days, no resolution)
 * @returns {Promise<Array<{pool_id: string, circle_id: string, circle_name: string, title: string, creator_name: string, kickoff_at: Date, closed_at: Date, predictions_count: number, days_since_closed: number}>>}
 */
async function getAbandonedCandidates() {
  const abandoned = await db.raw(`
    SELECT
      cp.id as pool_id,
      cp.circle_id,
      c.name as circle_name,
      cp.title,
      s.name as creator_name,
      cp.kickoff_at,
      cp.created_at as closed_at,
      COUNT(DISTINCT cpp.id) as predictions_count,
      EXTRACT(DAY FROM NOW() - cp.created_at) as days_since_closed
    FROM circle_pools cp
    JOIN circles c ON cp.circle_id = c.id
    JOIN students s ON cp.creator_id = s.id
    LEFT JOIN circle_pool_predictions cpp ON cpp.pool_id = cp.id
    WHERE cp.status = 'closed'
      AND cp.pool_type = 'private'
      AND cp.created_at < NOW() - INTERVAL '4 days'
      AND NOT EXISTS (
        SELECT 1 FROM circle_pool_resolutions r WHERE r.pool_id = cp.id
      )
    GROUP BY cp.id, c.id, c.name, s.name, cp.kickoff_at, cp.created_at
    ORDER BY cp.created_at ASC
  `);

  return abandoned.rows.map(d => ({
    pool_id: d.pool_id,
    circle_id: d.circle_id,
    circle_name: d.circle_name,
    title: d.title || '(untitled pool)',
    creator_name: d.creator_name,
    kickoff_at: d.kickoff_at,
    closed_at: d.closed_at,
    predictions_count: Number(d.predictions_count) || 0,
    days_since_closed: Math.floor(Number(d.days_since_closed) || 0),
  }));
}

/**
 * Get top active circles this week
 * @param {number} limit
 * @returns {Promise<Array<{circle_id: string, name: string, member_count: number, pools_7d: number, volume_7d: number, top_predictor_name: string}>>}
 */
async function getTopActiveCircles(limit = 20) {
  const date7d = new Date(Date.now() - 7 * 86400 * 1000);

  const topCircles = await db.raw(`
    SELECT
      c.id as circle_id,
      c.name,
      COUNT(DISTINCT cm.student_id) as member_count,
      COUNT(DISTINCT CASE WHEN cp.created_at >= ? THEN cp.id END) as pools_7d,
      COALESCE(SUM(CASE WHEN cpp.created_at >= ? THEN cpp.points_locked ELSE 0 END), 0) as volume_7d,
      (
        SELECT s.name
        FROM circle_pool_predictions cpp2
        JOIN circle_pools cp2 ON cpp2.pool_id = cp2.id
        LEFT JOIN students s ON cpp2.student_id = s.id
        WHERE cp2.circle_id = c.id
          AND cpp2.created_at >= ?
        GROUP BY s.id, s.name
        ORDER BY SUM(cpp2.points_locked) DESC
        LIMIT 1
      ) as top_predictor_name
    FROM circles c
    LEFT JOIN circle_members cm ON cm.circle_id = c.id
    LEFT JOIN circle_pools cp ON cp.circle_id = c.id
    LEFT JOIN circle_pool_predictions cpp ON cpp.pool_id = cp.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, c.name
    HAVING COUNT(DISTINCT CASE WHEN cp.created_at >= ? THEN cp.id END) > 0
      OR COALESCE(SUM(CASE WHEN cpp.created_at >= ? THEN cpp.points_locked ELSE 0 END), 0) > 0
    ORDER BY volume_7d DESC
    LIMIT ?
  `, [date7d, date7d, date7d, date7d, date7d, limit]);

  return topCircles.rows.map(row => ({
    circle_id: row.circle_id,
    name: row.name,
    member_count: Number(row.member_count) || 0,
    pools_7d: Number(row.pools_7d) || 0,
    volume_7d: Number(row.volume_7d) || 0,
    top_predictor_name: row.top_predictor_name || '—',
  }));
}

module.exports = {
  getOverviewStats,
  getDisputes,
  getAbandonedCandidates,
  getTopActiveCircles,
};
