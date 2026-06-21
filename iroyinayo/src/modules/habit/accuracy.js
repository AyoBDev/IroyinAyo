const db = require('../../config/database');

const MIN_CALLS_HEADLINE = 3;
const MIN_CALLS_CATEGORY = 5;

async function getResolvedCalls(studentId, { since } = {}) {
  let query = db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .where('p.student_id', studentId)
    .where('m.status', 'resolved')
    .whereNotIn('m.status', ['void', 'canceled'])
    .select(
      'p.market_id',
      'p.outcome_id',
      'm.category',
      'm.winning_outcome_id',
      'p.shares'
    );
  if (since) {
    query = query.where('m.resolved_at', '>=', since);
  }
  const rows = await query;

  const byMarket = new Map();
  for (const row of rows) {
    const key = row.market_id;
    if (!byMarket.has(key)) {
      byMarket.set(key, {
        netByOutcome: new Map(),
        category: row.category,
        winningOutcomeId: row.winning_outcome_id
      });
    }
    const m = byMarket.get(key);
    m.netByOutcome.set(row.outcome_id, (m.netByOutcome.get(row.outcome_id) || 0) + Number(row.shares));
  }

  const calls = [];
  for (const [, m] of byMarket) {
    const entries = [...m.netByOutcome.entries()].filter(([, n]) => n > 0);
    if (entries.length !== 1) continue;
    const [outcomeId] = entries[0];
    calls.push({ category: m.category, correct: outcomeId === m.winningOutcomeId });
  }
  return calls;
}

async function computeAccuracy(studentId, opts = {}) {
  const calls = await getResolvedCalls(studentId, opts);
  const resolvedCalls = calls.length;
  const correct = calls.filter((c) => c.correct).length;
  return {
    resolvedCalls,
    correct,
    accuracy: resolvedCalls >= MIN_CALLS_HEADLINE ? correct / resolvedCalls : null,
  };
}

async function computeCategoryAccuracy(studentId) {
  const calls = await getResolvedCalls(studentId);
  const byCategory = new Map();
  for (const call of calls) {
    if (!byCategory.has(call.category)) byCategory.set(call.category, { resolvedCalls: 0, correct: 0 });
    const c = byCategory.get(call.category);
    c.resolvedCalls += 1;
    if (call.correct) c.correct += 1;
  }
  return [...byCategory.entries()]
    .filter(([, c]) => c.resolvedCalls >= MIN_CALLS_CATEGORY)
    .map(([category, c]) => ({
      category,
      resolvedCalls: c.resolvedCalls,
      correct: c.correct,
      accuracy: c.correct / c.resolvedCalls,
    }));
}

function collapseCallsByStudent(rows) {
  const byStudent = new Map();
  for (const row of rows) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, new Map());
    const markets = byStudent.get(row.student_id);
    if (!markets.has(row.market_id)) {
      markets.set(row.market_id, {
        netByOutcome: new Map(),
        category: row.category,
        winningOutcomeId: row.winning_outcome_id
      });
    }
    const m = markets.get(row.market_id);
    m.netByOutcome.set(row.outcome_id, (m.netByOutcome.get(row.outcome_id) || 0) + Number(row.shares));
  }
  const callsByStudent = new Map();
  for (const [studentId, markets] of byStudent) {
    const calls = [];
    for (const [, m] of markets) {
      const entries = [...m.netByOutcome.entries()].filter(([, n]) => n > 0);
      if (entries.length !== 1) continue;
      const [outcomeId] = entries[0];
      calls.push({ category: m.category, correct: outcomeId === m.winningOutcomeId });
    }
    callsByStudent.set(studentId, calls);
  }
  return callsByStudent;
}

async function computeAccuracyRank(studentId) {
  const rows = await db('multi_market_positions as p')
    .join('multi_markets as m', 'p.market_id', 'm.id')
    .join('students as s', 'p.student_id', 's.id')
    .where('m.status', 'resolved')
    .whereNotIn('m.status', ['void', 'canceled'])
    .where('s.is_system', false)
    .where('s.is_banned', false)
    .select(
      'p.student_id',
      'p.market_id',
      'p.outcome_id',
      'p.shares',
      'm.category',
      'm.winning_outcome_id'
    );

  const callsByStudent = collapseCallsByStudent(rows);
  const accuracies = [];
  for (const [sid, calls] of callsByStudent) {
    const resolvedCalls = calls.length;
    if (resolvedCalls < MIN_CALLS_HEADLINE) continue;
    const correct = calls.filter((c) => c.correct).length;
    accuracies.push({ studentId: sid, accuracy: correct / resolvedCalls });
  }
  accuracies.sort((a, b) => b.accuracy - a.accuracy);
  const totalRanked = accuracies.length;
  const idx = accuracies.findIndex((a) => a.studentId === studentId);
  if (idx === -1) return { rank: null, percentile: null, totalRanked };
  const rank = idx + 1;
  return { rank, totalRanked, percentile: ((totalRanked - rank + 1) / totalRanked) * 100 };
}

module.exports = { computeAccuracy, computeCategoryAccuracy, computeAccuracyRank, MIN_CALLS_HEADLINE, MIN_CALLS_CATEGORY };
