const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

async function register({ phone_number, name, faculty, department, level, interests }) {
  const existing = await db('students').where({ phone_number }).first();
  if (existing) {
    throw new ValidationError('Phone number already registered');
  }

  const student = await db.transaction(async (trx) => {
    const [s] = await trx('students')
      .insert({ phone_number, name, faculty, department, level, is_onboarded: true })
      .returning('*');

    if (interests && interests.length > 0) {
      const rows = interests.map((category) => ({
        student_id: s.id,
        category,
      }));
      await trx('student_interests').insert(rows);
    }

    return s;
  });

  const studentInterests = await db('student_interests')
    .where({ student_id: student.id })
    .select('category');

  return { ...student, interests: studentInterests.map((i) => i.category) };
}

async function getById(id) {
  const student = await db('students').where({ id }).first();
  if (!student) throw new NotFoundError('Student not found');

  const interests = await db('student_interests')
    .where({ student_id: id })
    .select('category');

  return { ...student, interests: interests.map((i) => i.category) };
}

async function getByPhone(phone_number) {
  const student = await db('students').where({ phone_number }).first();
  if (!student) return null;

  const interests = await db('student_interests')
    .where({ student_id: student.id })
    .select('category');

  return { ...student, interests: interests.map((i) => i.category) };
}

async function updateInterests(id, interests) {
  const student = await db('students').where({ id }).first();
  if (!student) throw new NotFoundError('Student not found');

  await db.transaction(async (trx) => {
    await trx('student_interests').where({ student_id: id }).delete();
    if (interests.length > 0) {
      const rows = interests.map((category) => ({
        student_id: id,
        category,
      }));
      await trx('student_interests').insert(rows);
    }
  });

  return getById(id);
}

async function updateProfile(id, updates) {
  const student = await db('students').where({ id }).first();
  if (!student) throw new NotFoundError('Student not found');

  const allowed = ['name', 'faculty', 'department', 'level'];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }
  filtered.updated_at = new Date();

  await db('students').where({ id }).update(filtered);
  return getById(id);
}

async function listAll({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const students = await db('students')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const countResult = await db('students').count('id as count').first();
  const total = parseInt(countResult.count, 10);

  return { students, total, page, limit };
}

module.exports = { register, getById, getByPhone, updateInterests, updateProfile, listAll };
