const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

describe('POST /api/auth/login', () => {
  it('sends OTP code for a verified student (no direct token)', async () => {
    await db('students')
      .insert({ phone_number: '2348012345678', name: 'Tester', is_verified: true, points_balance: 100 })
      .returning('*');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '08012345678' });

    expect(res.status).toBe(200);
    expect(res.body.codeSent).toBe(true);
    expect(res.body.returning).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it('returns uniform response for unknown phone number (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '09099999999' });

    expect(res.status).toBe(200);
    expect(res.body.codeSent).toBe(true);
    expect(res.body.returning).toBeUndefined();
  });

  it('returns uniform response for unverified student (no enumeration)', async () => {
    await db('students')
      .insert({ phone_number: '2348055555555', name: '2348055555555', is_verified: false, points_balance: 0 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phoneNumber: '08055555555' });

    expect(res.status).toBe(200);
    expect(res.body.codeSent).toBe(true);
    expect(res.body.returning).toBeUndefined();
  });

  it('returns 400 if phoneNumber is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify', () => {
  it('creates student with provided name and marks as verified', async () => {
    const phone = '2348077777777';
    const code = '123456';
    const expires_at = new Date(Date.now() + 5 * 60 * 1000);
    await db('verification_codes').insert({ phone_number: phone, code, expires_at });

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ phoneNumber: '08077777777', code: '123456', name: 'Ada' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.student.name).toBe('Ada');

    const student = await db('students').where({ phone_number: phone }).first();
    expect(student.is_verified).toBe(true);
    expect(student.name).toBe('Ada');
  });

  it('returns 400 if name is missing', async () => {
    const phone = '2348066666666';
    const code = '654321';
    const expires_at = new Date(Date.now() + 5 * 60 * 1000);
    await db('verification_codes').insert({ phone_number: phone, code, expires_at });

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ phoneNumber: '08066666666', code: '654321' });

    expect(res.status).toBe(400);
  });
});
