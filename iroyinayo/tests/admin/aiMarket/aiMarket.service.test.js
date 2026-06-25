const db = require('../../../src/config/database');
const service = require('../../../src/modules/admin/aiMarket/aiMarket.service');
const trendCache = require('../../../src/modules/admin/aiMarket/trendCache');
const rateLimit = require('../../../src/modules/admin/aiMarket/rateLimit');
const { randomUUID: uuidv4 } = require('crypto');

beforeEach(async () => {
  // Re-seed house account after global setup truncates
  const house = await db('students').where({ is_system: true }).first();
  if (!house) {
    await db('students').insert({
      id: uuidv4(),
      name: 'IroyinMarket',
      phone_number: 'system',
      is_system: true,
      points_balance: 999999,
      is_onboarded: true,
      is_banned: false,
    });
  }
  trendCache._reset();
  rateLimit._reset();
});

function validDraft() {
  return {
    title: 'Will UNILAG beat OAU on Saturday?',
    outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
    category: 'sports',
    closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Resolves to the winner of the UNILAG vs OAU football match.',
  };
}

describe('draftMarket', () => {
  test('returns a valid draft when Groq returns valid JSON', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'llama-3.1-8b-instant', latencyMs: 100 });
    const out = await service.draftMarket({ adminId: 'admin-a', prompt: 'UNILAG vs OAU game', callJSONFn: fakeGroq });
    expect(out.title).toBe(validDraft().title);
    expect(out.model).toBe('llama-3.1-8b-instant');
    expect(out.latencyMs).toBe(100);
  });

  test('throws rate_limit_exceeded when admin exceeds RATE_PER_MIN', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'x', latencyMs: 1 });
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) {
      await service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq });
    }
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/rate_limit_exceeded/);
  });

  test('throws invalid_prompt when prompt fails validation', async () => {
    const fakeGroq = async () => ({ parsed: validDraft(), model: 'x', latencyMs: 1 });
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'no', callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws ai_returned_invalid_draft when Groq returns invalid category', async () => {
    const bad = { ...validDraft(), category: 'politics' };
    const fakeGroq = async () => ({ parsed: bad, model: 'x', latencyMs: 1 });
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/ai_returned_invalid_draft/);
  });

  test('propagates groq_unavailable from the callJSONFn', async () => {
    const fakeGroq = async () => { throw new Error('groq_unavailable: timeout'); };
    await expect(service.draftMarket({ adminId: 'admin-a', prompt: 'test prompt here', callJSONFn: fakeGroq }))
      .rejects.toThrow(/groq_unavailable/);
  });
});

describe('publishMarket', () => {
  test('creates a market with the draft values and returns the marketId', async () => {
    const draft = validDraft();
    const out = await service.publishMarket(draft);
    expect(out.title).toBe(draft.title);
    expect(out.marketId).toBeDefined();
    expect(out.status).toBe('open');

    const row = await db('multi_markets').where({ id: out.marketId }).first();
    expect(row.title).toBe(draft.title);
    expect(row.category).toBe(draft.category);
    expect(row.description).toBe(draft.description);

    const outcomes = await db('multi_market_outcomes').where({ market_id: out.marketId });
    expect(outcomes.length).toBe(draft.outcomes.length);
  });

  test('throws invalid_draft when category is invalid', async () => {
    const bad = { ...validDraft(), category: 'politics' };
    await expect(service.publishMarket(bad)).rejects.toThrow(/invalid_draft|category/);
  });

  test('throws invalid_draft when title is too short', async () => {
    const bad = { ...validDraft(), title: 'short' };
    await expect(service.publishMarket(bad)).rejects.toThrow(/invalid_draft|title/);
  });

  test('handles missing description (optional field)', async () => {
    const draft = validDraft();
    delete draft.description;
    const out = await service.publishMarket(draft);
    expect(out.marketId).toBeDefined();
  });
});

describe('getTrends', () => {
  test('returns cached result when within TTL', async () => {
    trendCache.set('admin-a', { trends: [{ title: 'cached', source: 's', url: 'https://e.com', category: 'sports' }], fetchedAt: new Date().toISOString(), latencyMs: 10, partialFailure: false });
    const out = await service.getTrends({ adminId: 'admin-a' });
    expect(out.cached).toBe(true);
    expect(out.trends[0].title).toBe('cached');
  });

  test('fetches fresh trends when cache is empty', async () => {
    const fakeGroq = async () => ({
      parsed: [
        { title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' },
      ],
      model: 'x', latencyMs: 50,
    });
    const fakeFetch = async () => ({ sports: [{ title: 'UNILAG vs OAU Saturday', link: 'https://goal.com/x', source: 'Goal Nigeria' }] });
    const out = await service.getTrends({ adminId: 'admin-a', callJSONFn: fakeGroq, fetchAllNewsFn: fakeFetch });
    expect(out.cached).toBe(false);
    expect(out.trends.length).toBe(1);
    expect(out.trends[0].source).toBe('Goal Nigeria');
  });

  test('filters out invalid trend suggestions', async () => {
    const fakeGroq = async () => ({
      parsed: [
        { title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' },
        { title: 'invalid', source: '', url: 'not-a-url', category: 'politics' },
      ],
      model: 'x', latencyMs: 50,
    });
    const fakeFetch = async () => ({ sports: [{ title: 'x', link: 'https://goal.com/x' }] });
    const out = await service.getTrends({ adminId: 'admin-a', callJSONFn: fakeGroq, fetchAllNewsFn: fakeFetch });
    expect(out.trends.length).toBe(1);
  });
});
