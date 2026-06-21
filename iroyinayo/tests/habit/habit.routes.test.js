const request = require('supertest');
const db = require('../../src/config/database');
const app = require('../../src/app');
const { generateStudentToken } = require('../../src/middleware/studentAuth');
const crypto = require('crypto');

async function makeUserWithToken() {
  const id = crypto.randomUUID();
  await db('students').insert({
    id, phone_number: `234${Date.now()}${Math.floor(Math.random()*100000)}`, name: 'T',
    is_onboarded: true, points_balance: 1000,
  });
  const token = generateStudentToken(id);
  return { id, token };
}

describe('GET /api/habit/accuracy/:userId', () => {
  test('returns null accuracy for new users with no resolved calls', async () => {
    const { id } = await makeUserWithToken();
    const res = await request(app).get(`/api/habit/accuracy/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.allTime.accuracy).toBeNull();
    expect(res.body.allTime.resolvedCalls).toBe(0);
  });
});

describe('GET /api/habit/triggers/in-app-strip', () => {
  test('requires auth', async () => {
    const res = await request(app).get('/api/habit/triggers/in-app-strip');
    expect(res.status).toBe(401);
  });

  test('returns empty list when user has no open positions', async () => {
    const { token } = await makeUserWithToken();
    const res = await request(app).get('/api/habit/triggers/in-app-strip').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sharpMoves).toEqual([]);
  });
});

describe('POST /api/habit/opt-in', () => {
  test('requires auth', async () => {
    const res = await request(app).post('/api/habit/opt-in');
    expect(res.status).toBe(401);
  });

  test('sets wa_daily_enabled to true', async () => {
    const { id, token } = await makeUserWithToken();
    const res = await request(app).post('/api/habit/opt-in').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const student = await db('students').where({ id }).first();
    expect(student.wa_daily_enabled).toBe(true);
  });
});
