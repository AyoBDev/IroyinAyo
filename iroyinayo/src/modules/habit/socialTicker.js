const db = require('../../config/database');

const MILESTONES = [100, 250, 500, 1000, 2500, 5000];
const PEER_LOOKBACK_DAYS = 7;
const PEER_RECENT_MINUTES = 60;

/**
 * Compute the Beat 3 social ticker condition for a prediction
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.marketId
 * @param {string} params.outcomeId
 * @param {number} params.totalPredictionsAfter - total predictions on this market after this one
 * @returns {Promise<{type: string, copy: string} | null>}
 */
async function computeSocialTicker({ studentId, marketId, outcomeId, totalPredictionsAfter }) {
  // Condition 1: Alone on this side
  const aloneOnSide = await db('multi_market_positions')
    .where({ market_id: marketId, outcome_id: outcomeId })
    .whereNot('student_id', studentId)
    .count('* as c')
    .first();
  if (Number(aloneOnSide.c) === 0) {
    return { type: 'alone', copy: "You're alone on this." };
  }

  // Condition 2: Peer opposite
  // Find users this student has predicted alongside in the last 7 days, then check if any of them
  // took the opposite side in the last 60 minutes.
  // Use a single query with subqueries to avoid N+1.
  const lookbackTime = new Date(Date.now() - PEER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const recentTime = new Date(Date.now() - PEER_RECENT_MINUTES * 60 * 1000);

  const peerOpposite = await db('multi_market_positions as recent')
    .join('students as s', 'recent.student_id', 's.id')
    .where('recent.market_id', marketId)
    .whereNot('recent.outcome_id', outcomeId)
    .where('recent.created_at', '>=', recentTime)
    .where('s.is_banned', false)
    .whereIn('recent.student_id', function() {
      // Subquery: find peer IDs — students who have predicted alongside me in the last 7 days
      this.select('peer.student_id')
        .from('multi_market_positions as mine')
        .join('multi_market_positions as peer', function() {
          this.on('mine.market_id', 'peer.market_id')
              .andOn('mine.outcome_id', 'peer.outcome_id');
        })
        .where('mine.student_id', studentId)
        .where('mine.created_at', '>=', lookbackTime)
        .whereNot('peer.student_id', studentId);
    })
    .select('s.name')
    .first();

  if (peerOpposite) {
    return { type: 'peer_opposite', copy: `${peerOpposite.name} called the opposite an hour ago.` };
  }

  // Condition 3: Volume milestone
  for (const m of MILESTONES) {
    if (totalPredictionsAfter === m) {
      return { type: 'milestone', copy: `You're prediction #${m} on this market.` };
    }
  }

  return null;
}

module.exports = { computeSocialTicker };
