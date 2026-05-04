const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function getAdminToken() {
  const email = `testadmin${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.com`;
  const password_hash = await bcrypt.hash('password123', 10);
  const [admin] = await db('admins')
    .insert({ email, password_hash, name: 'Test Admin', role: 'super_admin' })
    .returning(['id', 'role']);
  return jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
}

function authRequest(method, path, token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

module.exports = { getAdminToken, authRequest };
