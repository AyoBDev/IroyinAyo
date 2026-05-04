const request = require('supertest');
const app = require('../src/app');
const { getAdminToken } = require('./helpers');

async function createStudent(overrides = {}) {
  const res = await request(app).post('/api/students').send({
    phone_number: `${String(Date.now()).slice(-10)}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`.slice(0, 14),
    name: 'Test Student', interests: ['tech'], ...overrides,
  });
  return res.body;
}

async function createQuiz(token, overrides = {}) {
  const res = await request(app).post('/api/gamification/quizzes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      question: 'What is the capital of Nigeria?',
      options: ['Lagos', 'Abuja', 'Kano', 'Ibadan'],
      correct_option: 'B', ...overrides,
    });
  return res.body;
}

describe('Gamification API', () => {
  let adminToken;

  beforeEach(async () => {
    adminToken = await getAdminToken();
  });

  describe('Points', () => {
    test('new student starts with 0 points', async () => {
      const student = await createStudent();
      const res = await request(app).get(`/api/gamification/points/${student.id}`);
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(0);
    });
  });

  describe('Quizzes', () => {
    test('creates a quiz', async () => {
      const res = await request(app).post('/api/gamification/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'What year was Unilorin founded?',
          options: ['1970', '1975', '1962', '1980'],
          correct_option: 'B', category: 'academic',
        });
      expect(res.status).toBe(201);
      expect(res.body.question).toBe('What year was Unilorin founded?');
    });

    test('correct answer awards points', async () => {
      const student = await createStudent();
      const quiz = await createQuiz(adminToken);
      const answerRes = await request(app)
        .post(`/api/gamification/quizzes/${quiz.id}/answer`)
        .send({ student_id: student.id, selected_option: 'B' });
      expect(answerRes.status).toBe(200);
      expect(answerRes.body.correct).toBe(true);
      expect(answerRes.body.points_earned).toBe(10);
      const pointsRes = await request(app).get(`/api/gamification/points/${student.id}`);
      expect(pointsRes.body.balance).toBe(10);
    });

    test('wrong answer awards no points', async () => {
      const student = await createStudent();
      const quiz = await createQuiz(adminToken);
      const answerRes = await request(app)
        .post(`/api/gamification/quizzes/${quiz.id}/answer`)
        .send({ student_id: student.id, selected_option: 'A' });
      expect(answerRes.status).toBe(200);
      expect(answerRes.body.correct).toBe(false);
      expect(answerRes.body.points_earned).toBe(0);
    });

    test('cannot answer same quiz twice', async () => {
      const student = await createStudent();
      const quiz = await createQuiz(adminToken);
      await request(app).post(`/api/gamification/quizzes/${quiz.id}/answer`)
        .send({ student_id: student.id, selected_option: 'B' });
      const res = await request(app).post(`/api/gamification/quizzes/${quiz.id}/answer`)
        .send({ student_id: student.id, selected_option: 'A' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already answered/i);
    });
  });

  describe('Leaderboard', () => {
    test('returns students ranked by points earned', async () => {
      const student1 = await createStudent({ name: 'Top Student' });
      const student2 = await createStudent({ name: 'Second Student' });
      const quiz1 = await createQuiz(adminToken, { question: 'Q1' });
      const quiz2 = await createQuiz(adminToken, { question: 'Q2' });
      await request(app).post(`/api/gamification/quizzes/${quiz1.id}/answer`)
        .send({ student_id: student1.id, selected_option: 'B' });
      await request(app).post(`/api/gamification/quizzes/${quiz2.id}/answer`)
        .send({ student_id: student1.id, selected_option: 'B' });
      await request(app).post(`/api/gamification/quizzes/${quiz1.id}/answer`)
        .send({ student_id: student2.id, selected_option: 'B' });
      const res = await request(app).get('/api/gamification/leaderboard?period=weekly');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].name).toBe('Top Student');
      expect(Number(res.body[0].total_points)).toBe(20);
      expect(res.body[1].name).toBe('Second Student');
      expect(Number(res.body[1].total_points)).toBe(10);
    });
  });

  describe('Transaction history', () => {
    test('returns point transactions for a student', async () => {
      const student = await createStudent();
      const quiz = await createQuiz(adminToken);
      await request(app).post(`/api/gamification/quizzes/${quiz.id}/answer`)
        .send({ student_id: student.id, selected_option: 'B' });
      const res = await request(app).get(`/api/gamification/points/${student.id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].type).toBe('quiz');
      expect(res.body[0].amount).toBe(10);
    });
  });
});
