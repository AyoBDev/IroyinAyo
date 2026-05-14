const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

describe('POST /api/auth/login', () => {
  it('returns token for a verified student', async () => {
    const [student] = await db('students')
      .insert({ phone_number: '2348012345678', name: 'Tester', is_verified: true, points_balance: 100 })
      .returning('*');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '08012345678' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.student.id).toBe(student.id);
    expect(res.body.student.name).toBe('Tester');
  });

  it('returns exists: false for unknown phone number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '09099999999' });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it('returns exists: false for unverified student', async () => {
    await db('students')
      .insert({ phone_number: '2348055555555', name: '2348055555555', is_verified: false, points_balance: 0 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '08055555555' });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it('returns 400 if phoneNumber is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});
