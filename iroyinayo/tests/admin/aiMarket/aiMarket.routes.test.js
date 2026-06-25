const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../src/app');
const db = require('../../../src/config/database');
const { randomUUID: uuidv4 } = require('crypto');
const aiMarketService = require('../../../src/modules/admin/aiMarket/aiMarket.service');

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
});

async function adminToken(role = 'super_admin') {
  const id = uuidv4();
  await db('admins').insert({
    id, email: `a-${id.slice(0, 8)}@t.com`, password_hash: 'x', role, name: 'T',
  });
  return { token: jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret'), id };
}

describe('POST /api/admin/ai-market/draft', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/draft').send({ prompt: 'test prompt here' });
    expect(res.status).toBe(401);
  });

  test('403 when role is not super_admin or moderator', async () => {
    const id = uuidv4();
    await db('admins').insert({ id, email: `v-${id.slice(0,8)}@t.com`, password_hash: 'x', role: 'viewer', name: 'V' });
    const token = jwt.sign({ id }, process.env.JWT_SECRET || 'test-secret');
    const res = await request(app)
      .post('/api/admin/ai-market/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'test prompt here' });
    expect(res.status).toBe(403);
  });

  test('400 on invalid prompt', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/admin/ai-market/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'no' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/);
  });

  test('200 with draft when service returns a draft', async () => {
    const fakeDraft = {
      title: 'Will UNILAG beat OAU on Saturday?',
      outcomes: ['UNILAG', 'OAU', 'Draw'],
      category: 'sports',
      closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      description: 'Test description',
      model: 'llama-3.1-8b-instant',
      latencyMs: 120,
    };
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => fakeDraft;
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'UNILAG vs OAU game' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe(fakeDraft.title);
      expect(res.body.outcomes).toEqual(fakeDraft.outcomes);
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });

  test('429 on rate limit exceeded', async () => {
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => {
      const err = new aiMarketService.StructuredError('rate_limit_exceeded', 'too fast');
      err.retryAfterSeconds = 30;
      throw err;
    };
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'test prompt here' });
      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBe(30);
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });

  test('502 when Groq returns invalid draft', async () => {
    const orig = aiMarketService.draftMarket;
    aiMarketService.draftMarket = async () => { throw new aiMarketService.StructuredError('ai_returned_invalid_draft', 'bad'); };
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'test prompt here' });
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ai_returned_invalid_draft');
    } finally {
      aiMarketService.draftMarket = orig;
    }
  });
});

describe('POST /api/admin/ai-market/publish', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/publish').send({});
    expect(res.status).toBe(401);
  });

  test('200 and creates a real market when payload is valid', async () => {
    const { token } = await adminToken();
    const draft = {
      title: 'Will UNILAG beat OAU on Saturday?',
      outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
      category: 'sports',
      closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      description: 'Resolves to the winner of the UNILAG vs OAU football match.',
    };
    const res = await request(app)
      .post('/api/admin/ai-market/publish')
      .set('Authorization', `Bearer ${token}`)
      .send(draft);
    expect(res.status).toBe(200);
    expect(res.body.marketId).toBeDefined();
    expect(res.body.status).toBe('open');

    const row = await db('multi_markets').where({ id: res.body.marketId }).first();
    expect(row.description).toBe(draft.description);
  });

  test('400 when category is invalid', async () => {
    const { token } = await adminToken();
    const res = await request(app)
      .post('/api/admin/ai-market/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Will UNILAG beat OAU Saturday?', outcomes: ['a', 'b'], category: 'politics', closesAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/ai-market/trends', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/admin/ai-market/trends');
    expect(res.status).toBe(401);
  });

  test('200 and returns a trends list', async () => {
    const orig = aiMarketService.getTrends;
    aiMarketService.getTrends = async () => ({
      trends: [{ title: 'Will UNILAG beat OAU Saturday?', source: 'Goal Nigeria', url: 'https://goal.com/x', category: 'sports' }],
      fetchedAt: new Date().toISOString(),
      latencyMs: 50,
      partialFailure: false,
      cached: false,
    });
    try {
      const { token } = await adminToken();
      const res = await request(app)
        .post('/api/admin/ai-market/trends')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.trends.length).toBe(1);
      expect(res.body.cached).toBe(false);
    } finally {
      aiMarketService.getTrends = orig;
    }
  });
});
