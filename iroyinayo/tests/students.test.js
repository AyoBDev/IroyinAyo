const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

describe('Students API', () => {
  describe('POST /api/students', () => {
    test('registers a new student with interests', async () => {
      const res = await request(app).post('/api/students').send({
        phone_number: '2348012345678',
        name: 'Adewale',
        faculty: 'Engineering',
        department: 'Computer Engineering',
        level: '300',
        interests: ['tech', 'scholarships', 'sports'],
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Adewale');
      expect(res.body.phone_number).toBe('2348012345678');
      expect(res.body.is_onboarded).toBe(true);
      expect(res.body.points_balance).toBe(0);
      expect(res.body.interests).toEqual(
        expect.arrayContaining(['tech', 'scholarships', 'sports'])
      );
    });

    test('rejects duplicate phone number', async () => {
      await request(app).post('/api/students').send({
        phone_number: '2348099999999',
        name: 'First',
      });

      const res = await request(app).post('/api/students').send({
        phone_number: '2348099999999',
        name: 'Second',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already registered/i);
    });

    test('rejects invalid interest category', async () => {
      const res = await request(app).post('/api/students').send({
        phone_number: '2348011111111',
        name: 'Test',
        interests: ['invalid_category'],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid/i);
    });

    test('rejects missing required fields', async () => {
      const res = await request(app).post('/api/students').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/students/:id', () => {
    test('returns student with interests', async () => {
      const createRes = await request(app).post('/api/students').send({
        phone_number: '2348022222222',
        name: 'Bola',
        interests: ['entertainment', 'career'],
      });

      const res = await request(app).get(`/api/students/${createRes.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Bola');
      expect(res.body.interests).toEqual(
        expect.arrayContaining(['entertainment', 'career'])
      );
    });

    test('returns 404 for non-existent student', async () => {
      const res = await request(app).get(
        '/api/students/00000000-0000-0000-0000-000000000000'
      );

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/students/:id/interests', () => {
    test('replaces student interests', async () => {
      const createRes = await request(app).post('/api/students').send({
        phone_number: '2348033333333',
        name: 'Chidi',
        interests: ['tech'],
      });

      const res = await request(app)
        .put(`/api/students/${createRes.body.id}/interests`)
        .send({ interests: ['sports', 'entertainment'] });

      expect(res.status).toBe(200);
      expect(res.body.interests).toEqual(
        expect.arrayContaining(['sports', 'entertainment'])
      );
      expect(res.body.interests).not.toContain('tech');
    });
  });

  describe('PATCH /api/students/:id', () => {
    test('updates student profile fields', async () => {
      const createRes = await request(app).post('/api/students').send({
        phone_number: '2348044444444',
        name: 'Damilola',
      });

      const res = await request(app)
        .patch(`/api/students/${createRes.body.id}`)
        .send({ name: 'Dami', level: '200' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Dami');
      expect(res.body.level).toBe('200');
    });

    test('rejects invalid level value', async () => {
      const createRes = await request(app).post('/api/students').send({
        phone_number: '2348055555555',
        name: 'Emeka',
      });

      const res = await request(app)
        .patch(`/api/students/${createRes.body.id}`)
        .send({ level: '600' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/students/:id/interests', () => {
    test('returns 404 for non-existent student', async () => {
      const res = await request(app)
        .put('/api/students/00000000-0000-0000-0000-000000000000/interests')
        .send({ interests: ['tech'] });

      expect(res.status).toBe(404);
    });
  });
});
