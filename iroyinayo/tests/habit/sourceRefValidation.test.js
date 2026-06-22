const request = require('supertest');
const db = require('../../src/config/database');
const app = require('../../src/app');
const { generateStudentToken } = require('../../src/middleware/studentAuth');
const crypto = require('crypto');

async function makeUserWithToken() {
  const id = crypto.randomUUID();
  await db('students').insert({
    id, phone_number: `234${Date.now()}${Math.floor(Math.random() * 100000)}`, name: 'T',
    is_onboarded: true, points_balance: 1000,
  });
  const token = generateStudentToken(id);
  return { id, token };
}

async function makeMarket() {
  const marketId = crypto.randomUUID();
  await db('multi_markets').insert({
    id: marketId,
    title: 'sourceRef test market',
    status: 'open',
    liquidity_b: 100,
    closes_at: new Date(Date.now() + 3600000),
  });
  const outcomeId = crypto.randomUUID();
  await db('multi_market_outcomes').insert({ id: outcomeId, market_id: marketId, label: 'YES', shares_sold: 0 });
  await db('multi_market_outcomes').insert({ id: crypto.randomUUID(), market_id: marketId, label: 'NO', shares_sold: 0 });
  return { marketId, outcomeId };
}

describe('POST /api/multi-markets/:id/predict — sourceRef validation', () => {
  test('accepts an allow-listed sourceRef and persists it', async () => {
    const { id: studentId, token } = await makeUserWithToken();
    const { marketId, outcomeId } = await makeMarket();
    const res = await request(app)
      .post(`/api/multi-markets/${marketId}/predict`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcomeId, amount: 5, sourceRef: 'wa_daily:rank' });
    expect(res.status).toBe(200);
    const pos = await db('multi_market_positions').where({ student_id: studentId, market_id: marketId }).first();
    expect(pos.source_ref).toBe('wa_daily:rank');
  });

  test('rejects garbage sourceRef by storing null', async () => {
    const { id: studentId, token } = await makeUserWithToken();
    const { marketId, outcomeId } = await makeMarket();
    const res = await request(app)
      .post(`/api/multi-markets/${marketId}/predict`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcomeId, amount: 5, sourceRef: 'evil; drop table--' });
    expect(res.status).toBe(200);
    const pos = await db('multi_market_positions').where({ student_id: studentId, market_id: marketId }).first();
    expect(pos.source_ref).toBeNull();
  });
});
