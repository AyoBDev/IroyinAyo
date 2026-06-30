const db = require('../src/config/database');
const fixturesService = require('../src/modules/crews/fixtures.service');
const crewsService = require('../src/modules/crews/service');
const poolsService = require('../src/modules/crews/pools.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name, phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

describe('Fixtures service', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('crew_pool_predictions').del();
    await db('crew_pool_resolutions').del();
    await db('crew_pools').del();
    await db('crew_invites').del();
    await db('crew_members').del();
    await db('crews').del();
    await db('students').del();
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

  test('resolvePoolsForFixture auto-resolves a public pool with payouts', async () => {
    // Set up fixture
    const [fixture] = await db('fixtures').insert({
      external_id: 'auto-test', source: 'football-data',
      home_team: 'France', away_team: 'England',
      kickoff_at: new Date(Date.now() + 1000), status: 'scheduled',
    }).returning('*');

    // Set up crew with 3 members
    const creator = await makeStudent('Creator');
    const { crew, inviteToken } = await crewsService.createCrew('FC', creator.id);
    const m1 = await makeStudent('M1');
    const m2 = await makeStudent('M2');
    await crewsService.joinCrewByToken(inviteToken, m1.id);
    await crewsService.joinCrewByToken(inviteToken, m2.id);

    // Create public pool tied to fixture
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: fixture.id,
      kickoffAt: new Date(Date.now() + 1000), stakeAmount: 100,
    });

    // Predictions: home/home/away
    await poolsService.predictInPool(pool.id, { studentId: creator.id }, 'home');
    await poolsService.predictInPool(pool.id, { studentId: m1.id }, 'home');
    await poolsService.predictInPool(pool.id, { studentId: m2.id }, 'away');

    // Force-close the pool (simulating kickoff has passed)
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });

    // Trigger auto-resolution with winner=home
    const resolvedCount = await fixturesService.resolvePoolsForFixture(fixture.id, 'home');
    expect(resolvedCount).toBe(1);

    // Pot 300, 2 winners → each gets 150
    const after = {
      creator: (await db('students').where({ id: creator.id }).first()).points_balance,
      m1: (await db('students').where({ id: m1.id }).first()).points_balance,
      m2: (await db('students').where({ id: m2.id }).first()).points_balance,
    };
    expect(after.creator).toBe(1000 - 100 + 150);
    expect(after.m1).toBe(1000 - 100 + 150);
    expect(after.m2).toBe(1000 - 100);

    const finalPool = await db('crew_pools').where({ id: pool.id }).first();
    expect(finalPool.status).toBe('resolved');
    expect(finalPool.winner_outcome).toBe('home');
  });

  test('manualSubmitResult auto-resolves attached pools', async () => {
    // Start fixture as scheduled so createPool's "not scheduled" guard passes.
    const [fixture] = await db('fixtures').insert({
      external_id: 'manual-test', source: 'football-data',
      home_team: 'A', away_team: 'B',
      kickoff_at: new Date(Date.now() + 60000), status: 'scheduled',
    }).returning('*');

    const creator = await makeStudent('Creator');
    const { crew, inviteToken } = await crewsService.createCrew('FC2', creator.id);
    const m1 = await makeStudent('M1');
    await crewsService.joinCrewByToken(inviteToken, m1.id);

    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: fixture.id,
      kickoffAt: new Date(Date.now() + 1000), stakeAmount: 50,
    });
    await poolsService.predictInPool(pool.id, { studentId: creator.id }, 'home');
    await poolsService.predictInPool(pool.id, { studentId: m1.id }, 'away');
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });

    // Match goes live, then admin submits result manually.
    await db('fixtures').where({ id: fixture.id }).update({ status: 'live' });
    const result = await fixturesService.manualSubmitResult(fixture.id, { home_score: 1, away_score: 0 });
    expect(result.winner).toBe('home');
    expect(result.poolsResolved).toBe(1);
    const finalPool = await db('crew_pools').where({ id: pool.id }).first();
    expect(finalPool.status).toBe('resolved');
    expect(finalPool.winner_outcome).toBe('home');
  });
});
