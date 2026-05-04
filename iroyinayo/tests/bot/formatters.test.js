const {
  bold, numberedList, formatPoints, formatLeaderboard,
  formatQuiz, formatMarketList, formatRewardOptions, formatPositions,
} = require('../../src/bot/formatters');

describe('Formatters', () => {
  test('bold wraps text in asterisks', () => {
    expect(bold('hello')).toBe('*hello*');
  });

  test('numberedList formats items', () => {
    const result = numberedList(['first', 'second']);
    expect(result).toBe('1. first\n2. second');
  });

  test('formatPoints shows balance', () => {
    const result = formatPoints(250);
    expect(result).toContain('250');
    expect(result).toContain('pts');
  });

  test('formatLeaderboard shows ranked students', () => {
    const entries = [
      { name: 'Alice', total_points: 100 },
      { name: 'Bob', total_points: 50 },
    ];
    const result = formatLeaderboard(entries);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('🥇');
    expect(result).toContain('🥈');
  });

  test('formatLeaderboard handles empty', () => {
    expect(formatLeaderboard([])).toContain('No leaderboard');
  });

  test('formatQuiz shows question and options', () => {
    const quiz = {
      question: 'Capital of Nigeria?',
      options: ['Lagos', 'Abuja', 'Kano', 'Ibadan'],
    };
    const result = formatQuiz(quiz);
    expect(result).toContain('Capital of Nigeria?');
    expect(result).toContain('A. Lagos');
    expect(result).toContain('D. Ibadan');
  });

  test('formatMarketList handles empty', () => {
    expect(formatMarketList([])).toContain('No open markets');
  });

  test('formatRewardOptions shows options with costs', () => {
    const options = [
      { name: '100 NGN Airtime', points_cost: 500, value: '100 NGN' },
    ];
    const result = formatRewardOptions(options);
    expect(result).toContain('100 NGN Airtime');
    expect(result).toContain('500 pts');
  });

  test('formatPositions handles empty', () => {
    expect(formatPositions([])).toContain('no active predictions');
  });
});
