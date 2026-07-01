const db = require('../src/config/database');
const fixturesService = require('../src/modules/circles/fixtures.service');

describe('Fixtures service', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('fixtures').del();
  });

  test('manualSubmitResult stores result and computes winner', async () => {
    const [f] = await db('fixtures').insert({
      external_id: 'ext-1', source: 'football-data',
      home_team: 'France', away_team: 'England',
      kickoff_at: new Date(Date.now() - 3600 * 1000),
      status: 'live',
    }).returning('*');
    await fixturesService.manualSubmitResult(f.id, { home_score: 2, away_score: 1 });
    const after = await db('fixtures').where({ id: f.id }).first();
    expect(after.home_score).toBe(2);
    expect(after.away_score).toBe(1);
    expect(after.winner).toBe('home');
    expect(after.status).toBe('finished');
  });

  test('manualSubmitResult sets draw on equal scores', async () => {
    const [f] = await db('fixtures').insert({
      external_id: 'ext-2', source: 'football-data',
      home_team: 'A', away_team: 'B',
      kickoff_at: new Date(Date.now() - 3600 * 1000),
      status: 'live',
    }).returning('*');
    await fixturesService.manualSubmitResult(f.id, { home_score: 1, away_score: 1 });
    const after = await db('fixtures').where({ id: f.id }).first();
    expect(after.winner).toBe('draw');
  });

  test('getFixturesForDateRange returns fixtures in window', async () => {
    await db('fixtures').insert([
      { external_id: 'a', source: 'football-data', home_team: 'X', away_team: 'Y', kickoff_at: new Date(Date.now() + 1000), status: 'scheduled' },
      { external_id: 'b', source: 'football-data', home_team: 'X', away_team: 'Z', kickoff_at: new Date(Date.now() + 86400000), status: 'scheduled' },
      { external_id: 'c', source: 'football-data', home_team: 'X', away_team: 'W', kickoff_at: new Date(Date.now() + 7 * 86400000), status: 'scheduled' },
    ]);
    const result = await fixturesService.getFixturesForDateRange(new Date(), new Date(Date.now() + 2 * 86400000));
    expect(result).toHaveLength(2);
  });

  test('getFixturesForDateRange excludes finished/postponed fixtures', async () => {
    await db('fixtures').insert([
      { external_id: 'sched', source: 'football-data', home_team: 'A', away_team: 'B', kickoff_at: new Date(Date.now() + 3600000), status: 'scheduled' },
      { external_id: 'fin', source: 'football-data', home_team: 'C', away_team: 'D', kickoff_at: new Date(Date.now() + 7200000), status: 'finished' },
      { external_id: 'pp', source: 'football-data', home_team: 'E', away_team: 'F', kickoff_at: new Date(Date.now() + 10800000), status: 'postponed' },
    ]);
    const result = await fixturesService.getFixturesForDateRange(new Date(), new Date(Date.now() + 86400000));
    expect(result).toHaveLength(1);
    expect(result[0].external_id).toBe('sched');
  });

  // resolvePoolsForFixture and the circle-pool cascade in manualSubmitResult
  // were removed in the multi_markets refactor (migration 042). Crew public
  // pools now wrap multi_markets rows and auto-resolve via the resolveMarket
  // path in markets/multiMarkets.service.js — see tests/circles.public-resolution.test.js.
});
