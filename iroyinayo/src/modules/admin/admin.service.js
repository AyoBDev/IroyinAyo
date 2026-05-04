const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../../utils/errors');

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function register({ email, password, name, role, phone_number }) {
  const existing = await db('admins').where({ email }).first();
  if (existing) throw new ValidationError('Email already registered');
  const password_hash = await bcrypt.hash(password, 10);
  const [admin] = await db('admins')
    .insert({ email, password_hash, name, role: role || 'moderator', phone_number })
    .returning(['id', 'email', 'name', 'role', 'phone_number', 'created_at']);
  return admin;
}

async function login(email, password) {
  const admin = await db('admins').where({ email }).first();
  if (!admin) throw new UnauthorizedError('Invalid credentials');
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');
  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

async function getAnalytics() {
  const totalStudents = await db('students').count('id as count').first();
  const activeToday = await db('streaks')
    .where('last_active_date', new Date().toISOString().slice(0, 10))
    .count('id as count').first();
  const totalPointsIssued = await db('point_transactions')
    .where('amount', '>', 0).sum('amount as total').first();
  const totalRedemptions = await db('redemptions').count('id as count').first();
  const pendingRedemptions = await db('redemptions')
    .where({ status: 'pending' }).count('id as count').first();
  const openMarkets = await db('markets')
    .where({ status: 'open', is_approved: true }).count('id as count').first();

  return {
    total_students: Number(totalStudents.count),
    active_today: Number(activeToday.count),
    total_points_issued: Number(totalPointsIssued.total || 0),
    total_redemptions: Number(totalRedemptions.count),
    pending_redemptions: Number(pendingRedemptions.count),
    open_markets: Number(openMarkets.count),
  };
}

async function banStudent(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');
  await db('students').where({ id: studentId }).update({ is_banned: true });
  return db('students').where({ id: studentId }).first();
}

async function unbanStudent(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');
  await db('students').where({ id: studentId }).update({ is_banned: false });
  return db('students').where({ id: studentId }).first();
}

module.exports = { register, login, getAnalytics, banStudent, unbanStudent };
