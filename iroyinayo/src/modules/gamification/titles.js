const db = require('../../config/database');

const TITLES = [
  { id: 'newcomer', label: 'Newcomer', minPredictions: 0, minAccuracy: 0, color: '#7B8BA3' },
  { id: 'rookie', label: 'Rookie', minPredictions: 5, minAccuracy: 0, color: '#10B981' },
  { id: 'predictor', label: 'Predictor', minPredictions: 15, minAccuracy: 40, color: '#6366F1' },
  { id: 'analyst', label: 'Analyst', minPredictions: 30, minAccuracy: 50, color: '#6366F1' },
  { id: 'prophet', label: 'Prophet', minPredictions: 50, minAccuracy: 55, color: '#A78BFA' },
  { id: 'oracle', label: 'Oracle', minPredictions: 100, minAccuracy: 60, color: '#F59E0B' },
];

async function calculateTitle(studentId) {
  const positions = await db('multi_market_positions')
    .where({ student_id: studentId })
    .select('*');

  const total = positions.length;
  const resolved = positions.filter(p => p.payout !== null && p.payout !== undefined);
  const wins = resolved.filter(p => p.payout > 0).length;
  const accuracy = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

  let title = TITLES[0];
  for (const t of TITLES) {
    if (total >= t.minPredictions && accuracy >= t.minAccuracy) {
      title = t;
    }
  }

  return { title: title.label, titleId: title.id, titleColor: title.color, accuracy, totalPredictions: total, wins };
}

async function getStudentStats(studentId) {
  const streak = await db('streaks').where({ student_id: studentId }).first();
  const titleInfo = await calculateTitle(studentId);

  return {
    ...titleInfo,
    streak: streak?.current_streak || 0,
    longestStreak: streak?.longest_streak || 0,
  };
}

module.exports = { calculateTitle, getStudentStats, TITLES };
