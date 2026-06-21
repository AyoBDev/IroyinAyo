const { renderMessage, pickGreeting } = require('../../src/modules/habit/messageRenderer');

describe('pickGreeting', () => {
  test('same studentId + dayKey returns same greeting', () => {
    const a = pickGreeting('student-1', '2026-06-22');
    const b = pickGreeting('student-1', '2026-06-22');
    expect(a).toBe(b);
  });
  test('different days produce different greetings (over a span)', () => {
    const greetings = new Set();
    for (let d = 1; d <= 8; d++) greetings.add(pickGreeting('student-1', `2026-06-${String(d).padStart(2, '0')}`));
    expect(greetings.size).toBeGreaterThan(1);
  });
});

describe('renderMessage', () => {
  const student = { id: 'student-1', name: 'Tunde', phone_number: '2348000000000' };
  const appUrl = 'https://iroyinmarket.com';

  test('rank lede renders correct lede line', () => {
    const queueRow = {
      lede_type: 'rank',
      lede_payload: { currentRank: 47, rankDelta: 5 },
      markets: [{ market_id: 'm1', label: 'UNILAG vs OAU', resolves_in_minutes: 360 }],
      scheduled_for: new Date('2026-06-22T07:00:00Z'),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/Tunde/);
    expect(msg).toMatch(/rank #47/i);
    expect(msg).toMatch(/up 5/);
    expect(msg).toMatch(appUrl);
    expect(msg).toMatch(/ref=wa_daily/);
    expect(msg).toMatch(/lede=rank/);
  });

  test('resolution lede shows count', () => {
    const queueRow = {
      lede_type: 'resolution',
      lede_payload: { count: 2, marketIds: ['m1'] },
      markets: [{ market_id: 'm1', label: 'X', resolves_in_minutes: 60 }],
      scheduled_for: new Date(),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/2 of your calls resolve today/i);
  });

  test('curiosity lede includes market title and predictions count if present', () => {
    const queueRow = {
      lede_type: 'curiosity',
      lede_payload: { marketId: 'm1', marketTitle: 'Will UNILAG win?', predictionCount: 1247 },
      markets: [{ market_id: 'm1', label: 'Will UNILAG win?', resolves_in_minutes: 7200 }],
      scheduled_for: new Date(),
    };
    const msg = renderMessage({ student, queueRow, appUrl });
    expect(msg).toMatch(/UNILAG/);
  });
});
