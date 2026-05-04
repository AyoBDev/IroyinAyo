const request = require('supertest');
const app = require('../src/app');
const gamificationService = require('../src/modules/gamification/gamification.service');
const { getAdminToken } = require('./helpers');

async function createStudent(overrides = {}) {
  const res = await request(app).post('/api/students').send({
    phone_number: `0${String(Date.now()).slice(-10)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
    name: 'Test Student', interests: ['tech'], ...overrides,
  });
  return res.body;
}

async function createRewardOption(token, overrides = {}) {
  const res = await request(app).post('/api/rewards/options')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: '100 NGN Airtime', type: 'airtime', points_cost: 500, value: '100 NGN', ...overrides,
    });
  return res.body;
}

async function givePoints(studentId, amount) {
  await gamificationService.addPoints(studentId, amount, 'test', 'Test points');
}

describe('Rewards API', () => {
  let adminToken;

  beforeEach(async () => {
    adminToken = await getAdminToken();
  });

  describe('Reward options', () => {
    test('creates a reward option', async () => {
      const res = await request(app).post('/api/rewards/options')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '500MB Data Bundle', type: 'data', points_cost: 800, value: '500MB',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('500MB Data Bundle');
      expect(res.body.points_cost).toBe(800);
    });

    test('lists active reward options', async () => {
      await createRewardOption(adminToken, { name: 'Option A', points_cost: 500 });
      await createRewardOption(adminToken, { name: 'Option B', points_cost: 1000 });
      const res = await request(app).get('/api/rewards/options');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Redemption', () => {
    test('student redeems points for airtime', async () => {
      const student = await createStudent();
      await givePoints(student.id, 600);
      const option = await createRewardOption(adminToken, { points_cost: 500 });
      const res = await request(app).post('/api/rewards/redeem').send({
        student_id: student.id, reward_option_id: option.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.redemption.status).toBe('pending');
      expect(res.body.reward.name).toBe('100 NGN Airtime');
      const points = await request(app).get(`/api/gamification/points/${student.id}`);
      expect(points.body.balance).toBe(100);
    });

    test('rejects redemption below minimum points threshold', async () => {
      const student = await createStudent();
      await givePoints(student.id, 400);
      const option = await createRewardOption(adminToken, { points_cost: 300 });
      const res = await request(app).post('/api/rewards/redeem').send({
        student_id: student.id, reward_option_id: option.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/minimum/i);
    });

    test('rejects redemption with insufficient points', async () => {
      const student = await createStudent();
      await givePoints(student.id, 500);
      const option = await createRewardOption(adminToken, { points_cost: 600 });
      const res = await request(app).post('/api/rewards/redeem').send({
        student_id: student.id, reward_option_id: option.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient/i);
    });
  });

  describe('Fulfillment', () => {
    test('admin fulfills a pending redemption', async () => {
      const student = await createStudent();
      await givePoints(student.id, 600);
      const option = await createRewardOption(adminToken);
      const redeemRes = await request(app).post('/api/rewards/redeem').send({
        student_id: student.id, reward_option_id: option.id,
      });
      const fulfillRes = await request(app).post(`/api/rewards/${redeemRes.body.redemption.id}/fulfill`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fulfillRes.status).toBe(200);
      expect(fulfillRes.body.status).toBe('fulfilled');
      expect(fulfillRes.body.fulfilled_at).toBeTruthy();
    });

    test('lists pending redemptions', async () => {
      const student = await createStudent();
      await givePoints(student.id, 600);
      const option = await createRewardOption(adminToken);
      await request(app).post('/api/rewards/redeem').send({
        student_id: student.id, reward_option_id: option.id,
      });
      const res = await request(app).get('/api/rewards/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].student_name).toBe('Test Student');
    });
  });
});
