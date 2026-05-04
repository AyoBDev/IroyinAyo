const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const { getAdminToken } = require('./helpers');

async function createStudent(overrides = {}) {
  const suffix = String(Date.now()).slice(-10);
  const res = await request(app)
    .post('/api/students')
    .send({
      phone_number: `0${suffix}`,
      name: 'Test Student',
      interests: ['tech', 'scholarships'],
      ...overrides,
    });
  return res.body;
}

describe('Content API', () => {
  let adminToken;

  beforeEach(async () => {
    adminToken = await getAdminToken();
  });

  describe('POST /api/content', () => {
    test('creates content with categories', async () => {
      const res = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'New Scholarship Alert',
          body: 'Apply for the MTN Foundation Scholarship before May 30.',
          categories: ['scholarships'],
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Scholarship Alert');
      expect(res.body.categories).toContain('scholarships');
      expect(res.body.is_published).toBe(false);
    });

    test('creates broadcast content', async () => {
      const res = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Exam Timetable Released',
          body: 'Check the portal for your exam schedule.',
          is_broadcast: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.is_broadcast).toBe(true);
    });

    test('rejects invalid categories', async () => {
      const res = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test',
          body: 'Test body',
          categories: ['fake_category'],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/content/feed/:studentId', () => {
    test('returns personalized feed based on student interests', async () => {
      const student = await createStudent({ interests: ['scholarships'] });

      const scholarship = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Scholarship Info',
          body: 'New scholarship available.',
          categories: ['scholarships'],
        });
      await request(app).post(`/api/content/${scholarship.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const techContent = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Tech News',
          body: 'New iPhone released.',
          categories: ['entertainment'],
        });
      await request(app).post(`/api/content/${techContent.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app).get(`/api/content/feed/${student.id}`);

      expect(res.status).toBe(200);
      const titles = res.body.map((c) => c.title);
      expect(titles).toContain('Scholarship Info');
      expect(titles).not.toContain('Tech News');
    });

    test('includes broadcast content for all students', async () => {
      const student = await createStudent({ interests: ['tech'] });

      const broadcast = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'School Closes Friday',
          body: 'Campus closes for break.',
          is_broadcast: true,
        });
      await request(app).post(`/api/content/${broadcast.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app).get(`/api/content/feed/${student.id}`);

      expect(res.status).toBe(200);
      const titles = res.body.map((c) => c.title);
      expect(titles).toContain('School Closes Friday');
    });
  });

  describe('Content approval flow', () => {
    test('unapproved content does not appear in feed', async () => {
      const student = await createStudent({ interests: ['tech'] });

      const content = await request(app).post('/api/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Pending Content',
          body: 'Needs approval.',
          categories: ['tech'],
          is_approved: false,
        });
      await request(app).post(`/api/content/${content.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const feed = await request(app).get(`/api/content/feed/${student.id}`);
      const titles = feed.body.map((c) => c.title);
      expect(titles).not.toContain('Pending Content');

      const pending = await request(app).get('/api/content/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pending.body.length).toBeGreaterThan(0);

      await request(app).post(`/api/content/${content.body.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const feedAfter = await request(app).get(`/api/content/feed/${student.id}`);
      const titlesAfter = feedAfter.body.map((c) => c.title);
      expect(titlesAfter).toContain('Pending Content');
    });
  });
});
