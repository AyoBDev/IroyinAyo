const db = require('../src/config/database');

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  const tables = [
    'market_positions', 'markets', 'point_transactions', 'streaks',
    'quiz_answers', 'quizzes', 'redemptions', 'reward_options',
    'content_tags', 'content', 'student_interests', 'students', 'admins',
  ];
  for (const table of tables) {
    await db.raw(`TRUNCATE TABLE "${table}" CASCADE`).catch(() => {});
  }
});

afterAll(async () => {
  await db.destroy();
});
