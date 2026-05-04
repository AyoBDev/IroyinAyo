const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function seedSuperAdmin(overrides = {}) {
  const email = overrides.email || `seed${Date.now()}@test.com`;
  const password = overrides.password || 'password123';
  const password_hash = await bcrypt.hash(password, 10);
  const [admin] = await db('admins')
    .insert({ email, password_hash, name: overrides.name || 'Seed Admin', role: 'super_admin' })
    .returning(['id', 'email', 'name', 'role']);
  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
  return { admin, token, password };
}

async function registerAdmin(token, overrides = {}) {
  const res = await request(app).post('/api/admin/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: `admin${Date.now()}@test.com`,
      password: 'password123',
      name: 'Test Admin',
      role: 'super_admin',
      ...overrides,
    });
  return res;
}

async function loginAdmin(email, password) {
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body;
}

async function createStudent(overrides = {}) {
  const res = await request(app).post('/api/students').send({
    phone_number: `0${String(Date.now()).slice(-10)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
    name: 'Test Student', interests: ['tech'], ...overrides,
  });
  return res.body;
}

describe('Admin API', () => {
  describe('Registration & Login', () => {
    test('super_admin can register a new admin', async () => {
      const { token } = await seedSuperAdmin();
      const email = `admin${Date.now()}@unilorin.edu.ng`;
      const res = await registerAdmin(token, {
        email, password: 'securepass123', name: 'Admin One', role: 'super_admin',
      });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe('super_admin');
      expect(res.body.password_hash).toBeUndefined();
    });

    test('rejects unauthenticated registration', async () => {
      const res = await request(app).post('/api/admin/register').send({
        email: `unauth${Date.now()}@test.com`, password: 'password123', name: 'No Auth',
      });
      expect(res.status).toBe(401);
    });

    test('logs in and returns JWT token', async () => {
      const { admin, password } = await seedSuperAdmin();
      const res = await request(app).post('/api/admin/login').send({ email: admin.email, password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.admin.email).toBe(admin.email);
    });

    test('rejects wrong password', async () => {
      const { admin } = await seedSuperAdmin();
      const res = await request(app).post('/api/admin/login').send({ email: admin.email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });
  });

  describe('Analytics', () => {
    test('returns analytics for authenticated admin', async () => {
      const { token } = await seedSuperAdmin();
      const res = await request(app).get('/api/admin/analytics')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_students');
      expect(res.body).toHaveProperty('active_today');
      expect(res.body).toHaveProperty('total_points_issued');
      expect(res.body).toHaveProperty('open_markets');
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/admin/analytics');
      expect(res.status).toBe(401);
    });
  });

  describe('Student management', () => {
    test('super_admin can ban a student', async () => {
      const { token } = await seedSuperAdmin();
      const student = await createStudent();
      const res = await request(app).post(`/api/admin/students/${student.id}/ban`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.is_banned).toBe(true);
    });

    test('content_admin cannot ban students', async () => {
      const { token: superToken } = await seedSuperAdmin();
      const email = `contentadmin${Date.now()}@test.com`;
      await registerAdmin(superToken, {
        email, password: 'password123', name: 'Content Admin', role: 'content_admin',
      });
      const login = await loginAdmin(email, 'password123');
      const student = await createStudent();
      const res = await request(app).post(`/api/admin/students/${student.id}/ban`)
        .set('Authorization', `Bearer ${login.token}`);
      expect(res.status).toBe(403);
    });
  });
});
