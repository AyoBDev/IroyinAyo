const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

async function listPendingReports({ limit = 20 } = {}) {
  const items = await db('market_reports as r')
    .join('multi_markets as m', 'r.market_id', 'm.id')
    .join('students as s', 'r.student_id', 's.id')
    .where('r.resolution_status', 'pending')
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .select(
      'r.id',
      'r.market_id',
      'r.student_id',
      'r.reason',
      'r.created_at',
      'm.title as market_title',
      's.name as reporter_name'
    );
  const totalRow = await db('market_reports').where({ resolution_status: 'pending' }).count('id as c').first();
  return { items, total: Number(totalRow.c) };
}

async function updateReport(reportId, adminId, { action, note }) {
  const report = await db('market_reports').where({ id: reportId }).first();
  if (!report) throw new NotFoundError('Report not found');

  let newStatus;
  if (action === 'dismiss') newStatus = 'dismissed';
  else if (action === 'resolve') newStatus = 'resolved';
  else throw new ValidationError('Action must be "dismiss" or "resolve"');

  await db('market_reports').where({ id: reportId }).update({
    resolution_status: newStatus,
    resolution_note: note || null,
    resolved_at: new Date(),
    resolved_by_admin_id: adminId,
  });
  return { ok: true };
}

module.exports = { listPendingReports, updateReport };
