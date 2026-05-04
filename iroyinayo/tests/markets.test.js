const request = require('supertest');
const app = require('../src/app');
const gamificationService = require('../src/modules/gamification/gamification.service');
const { getAdminToken } = require('./helpers');

async function createStudent(overrides = {}) {
  const res = await request(app).post('/api/students').send({
    phone_number: `0${String(Date.now()).slice(-10)}${String(Math.floor(Math.random() * 10000)).padStart(4, '0').slice(0, 2)}`,
    name: 'Test Student', interests: ['sports'], ...overrides,
  });
  return res.body;
}

async function createMarket(token, overrides = {}) {
  const closesAt = new Date();
  closesAt.setDate(closesAt.getDate() + 7);
  const res = await request(app).post('/api/markets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      question: 'Will ASUU go on strike before June?',
      closes_at: closesAt.toISOString(),
      created_by_type: 'admin',
      created_by_id: '00000000-0000-0000-0000-000000000001',
      ...overrides,
    });
  return res.body;
}

async function givePoints(studentId, amount) {
  await gamificationService.addPoints(studentId, amount, 'test', 'Test points');
}

describe('Prediction Markets API', () => {
  let adminToken;

  beforeEach(async () => {
    adminToken = await getAdminToken();
  });

  describe('POST /api/markets', () => {
    test('admin creates an approved market', async () => {
      const market = await createMarket(adminToken);
      expect(market.question).toBe('Will ASUU go on strike before June?');
      expect(market.is_approved).toBe(true);
      expect(market.status).toBe('open');
      expect(market.yes_pool).toBe(0);
      expect(market.no_pool).toBe(0);
    });

    test('student creates an unapproved market', async () => {
      const student = await createStudent();
      const closesAt = new Date();
      closesAt.setDate(closesAt.getDate() + 3);
      const res = await request(app).post('/api/markets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'Will fuel price hit 1000 NGN?',
          closes_at: closesAt.toISOString(),
          created_by_type: 'student',
          created_by_id: student.id,
        });
      expect(res.status).toBe(201);
      expect(res.body.is_approved).toBe(false);
    });
  });

  describe('POST /api/markets/:id/buy', () => {
    test('student buys a yes position', async () => {
      const student = await createStudent();
      await givePoints(student.id, 100);
      const market = await createMarket(adminToken);
      const res = await request(app).post(`/api/markets/${market.id}/buy`).send({
        student_id: student.id, side: 'yes', amount: 50,
      });
      expect(res.status).toBe(200);
      expect(res.body.position.side).toBe('yes');
      expect(res.body.position.amount).toBe(50);
      expect(res.body.market.yes_pool).toBe(50);
    });

    test('rejects buy with insufficient points', async () => {
      const student = await createStudent();
      const market = await createMarket(adminToken);
      const res = await request(app).post(`/api/markets/${market.id}/buy`).send({
        student_id: student.id, side: 'yes', amount: 100,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient/i);
    });

    test('rejects buy exceeding max bet per market', async () => {
      const student = await createStudent();
      await givePoints(student.id, 1000);
      const market = await createMarket(adminToken);
      const res = await request(app).post(`/api/markets/${market.id}/buy`).send({
        student_id: student.id, side: 'yes', amount: 501,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/max bet/i);
    });
  });

  describe('AMM pricing', () => {
    test('prices shift based on demand', async () => {
      const student1 = await createStudent();
      const student2 = await createStudent();
      await givePoints(student1.id, 200);
      await givePoints(student2.id, 200);
      const market = await createMarket(adminToken);

      await request(app).post(`/api/markets/${market.id}/buy`).send({
        student_id: student1.id, side: 'yes', amount: 100,
      });
      let marketState = await request(app).get(`/api/markets/${market.id}`);
      expect(marketState.body.yes_price).toBe(1);
      expect(marketState.body.no_price).toBe(0);

      await request(app).post(`/api/markets/${market.id}/buy`).send({
        student_id: student2.id, side: 'no', amount: 100,
      });
      marketState = await request(app).get(`/api/markets/${market.id}`);
      expect(marketState.body.yes_price).toBe(0.5);
      expect(marketState.body.no_price).toBe(0.5);
    });
  });

  describe('POST /api/markets/:id/resolve', () => {
    test('resolves market and pays winners with 10% fee', async () => {
      const winner = await createStudent({ name: 'Winner' });
      const loser = await createStudent({ name: 'Loser' });
      await givePoints(winner.id, 100);
      await givePoints(loser.id, 100);
      const market = await createMarket(adminToken);

      await request(app).post(`/api/markets/${market.id}/buy`).send({ student_id: winner.id, side: 'yes', amount: 100 });
      await request(app).post(`/api/markets/${market.id}/buy`).send({ student_id: loser.id, side: 'no', amount: 100 });

      const resolveRes = await request(app).post(`/api/markets/${market.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'yes' });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.status).toBe('resolved');
      expect(resolveRes.body.outcome).toBe('yes');

      const winnerPoints = await request(app).get(`/api/gamification/points/${winner.id}`);
      expect(winnerPoints.body.balance).toBe(180);

      const loserPoints = await request(app).get(`/api/gamification/points/${loser.id}`);
      expect(loserPoints.body.balance).toBe(0);
    });

    test('sponsor bonus is included in payout pool', async () => {
      const winner = await createStudent({ name: 'Sponsored Winner' });
      await givePoints(winner.id, 100);
      const market = await createMarket(adminToken);

      await request(app).post(`/api/markets/${market.id}/sponsor`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 });
      await request(app).post(`/api/markets/${market.id}/buy`).send({ student_id: winner.id, side: 'yes', amount: 50 });

      await request(app).post(`/api/markets/${market.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'yes' });
      const points = await request(app).get(`/api/gamification/points/${winner.id}`);
      // Started 100, spent 50 = 50 remaining. Pool = 50 + 100 sponsor = 150, fee = 15, payout = 135. Total = 50 + 135 = 185
      expect(points.body.balance).toBe(50 + 135);
    });

    test('cannot resolve already resolved market', async () => {
      const market = await createMarket(adminToken);
      await request(app).post(`/api/markets/${market.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'yes' });
      const res = await request(app).post(`/api/markets/${market.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'no' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already resolved/i);
    });
  });

  describe('Market approval', () => {
    test('student market appears in pending list and can be approved', async () => {
      const student = await createStudent();
      const closesAt = new Date();
      closesAt.setDate(closesAt.getDate() + 3);
      await request(app).post('/api/markets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'Community market test?',
          closes_at: closesAt.toISOString(),
          created_by_type: 'student',
          created_by_id: student.id,
        });

      const pending = await request(app).get('/api/markets/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pending.body.length).toBeGreaterThan(0);
      const pendingMarket = pending.body.find((m) => m.question === 'Community market test?');
      expect(pendingMarket).toBeDefined();

      const approved = await request(app).post(`/api/markets/${pendingMarket.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approved.body.is_approved).toBe(true);

      const points = await request(app).get(`/api/gamification/points/${student.id}`);
      expect(points.body.balance).toBe(10);
    });
  });

  describe('GET /api/markets/student/:studentId', () => {
    test('returns positions for a student', async () => {
      const student = await createStudent();
      await givePoints(student.id, 200);
      const market = await createMarket(adminToken);
      await request(app).post(`/api/markets/${market.id}/buy`).send({ student_id: student.id, side: 'yes', amount: 50 });

      const res = await request(app).get(`/api/markets/student/${student.id}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].side).toBe('yes');
      expect(res.body[0].question).toBe('Will ASUU go on strike before June?');
    });
  });
});
