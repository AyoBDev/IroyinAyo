const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function getCurrentWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function getWeeklyWinnerStatus() {
  const weekStart = getCurrentWeekStart();
  const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
  if (!row) return null;
  return {
    weekStart: row.week_start,
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    winnerProfit: row.winner_profit,
    prizePaid: !!row.prize_paid,
    paidAt: row.paid_at,
    paidByAdminId: row.paid_by_admin_id,
  };
}

async function markWinnerPaid(weekStart, adminId) {
  // First check existence so we can throw NotFoundError vs. ValidationError correctly.
  const row = await db('weekly_leaderboards').where({ week_start: weekStart }).first();
  if (!row) throw new NotFoundError('Weekly winner row not found');

  // Atomic check-and-set: only updates if prize_paid is still false.
  const updated = await db('weekly_leaderboards')
    .where({ week_start: weekStart, prize_paid: false })
    .update({ prize_paid: true, paid_at: new Date(), paid_by_admin_id: adminId });
  if (updated === 0) throw new ValidationError('Already paid');
  return { ok: true };
}

module.exports = { getWeeklyWinnerStatus, markWinnerPaid };
