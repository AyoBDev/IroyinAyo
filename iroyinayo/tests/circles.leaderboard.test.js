const db = require('../src/config/database');
const circlesService = require('../src/modules/circles/service');
const poolsService = require('../src/modules/circles/pools.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    is_onboarded: true,
    is_banned: false,
    is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

describe('Circles Leaderboard', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('circle_pool_predictions').del();
    await db('circle_pool_resolutions').del();
    await db('circle_pools').del();
    await db('circle_invites').del();
    await db('circle_members').del();
    await db('circles').del();
    await db('students').del();
  });

  test('returns leaderboard with correct stats for 3 members: one correct, one wrong, one no predictions', async () => {
    const alice = await makeStudent('Alice');
    const bob = await makeStudent('Bob');
    const charlie = await makeStudent('Charlie');

    // Alice creates circle
    const { circle, inviteToken } = await circlesService.createCircle('Test Crew', alice.id);

    // Bob & Charlie join
    await circlesService.joinCircleByToken(inviteToken, bob.id);
    await circlesService.joinCircleByToken(inviteToken, charlie.id);

    // Alice creates a private pool
    const pool = await poolsService.createPool(circle.id, alice.id, {
      poolType: 'private',
      title: 'Test Pool',
      outcomeA: 'Yes',
      outcomeB: 'No',
      kickoffAt: new Date(Date.now() + 3600000).toISOString(),
      stakeAmount: 50,
    });

    // Alice predicts Yes, Bob predicts No, Charlie doesn't predict
    await poolsService.predictInPool(pool.id, { studentId: alice.id }, 'Yes');
    await poolsService.predictInPool(pool.id, { studentId: bob.id }, 'No');

    // Resolve: Alice wins (outcome Yes)
    await db('circle_pools').where({ id: pool.id }).update({ status: 'resolved', winner_outcome: 'Yes' });
    await db('circle_pool_resolutions').insert({
      pool_id: pool.id,
      source: 'creator',
      resolver_id: alice.id,
      winner_outcome: 'Yes',
      dispute_status: 'none',
    });

    // Alice wins pot: 3 members * 50 = 150 total. Only Alice correct, so she gets 150 payout.
    // net = 150 - 50 = 100
    // Bob: lost 50 (payout 0, locked 50) = -50 net
    // Charlie: 0 predictions
    await db('circle_pool_predictions').where({ pool_id: pool.id, student_id: alice.id }).update({ payout: 150 });
    await db('circle_pool_predictions').where({ pool_id: pool.id, student_id: bob.id }).update({ payout: 0 });

    const leaderboard = await circlesService.getLeaderboardForCircle(circle.id);
    expect(leaderboard).toHaveLength(3);

    // Alice should be 1st: +100 net, 100% accuracy
    expect(leaderboard[0].student_id).toBe(alice.id);
    expect(leaderboard[0].pools_predicted).toBe(1);
    expect(leaderboard[0].correct).toBe(1);
    expect(leaderboard[0].resolved_count).toBe(1);
    expect(leaderboard[0].accuracy).toBe(100);
    expect(leaderboard[0].net_points).toBe(100);

    // Charlie 2nd: 0 net (no predictions), accuracy null
    expect(leaderboard[1].student_id).toBe(charlie.id);
    expect(leaderboard[1].pools_predicted).toBe(0);
    expect(leaderboard[1].correct).toBe(0);
    expect(leaderboard[1].resolved_count).toBe(0);
    expect(leaderboard[1].accuracy).toBeNull();
    expect(leaderboard[1].net_points).toBe(0);

    // Bob 3rd: -50 net, 0% accuracy
    expect(leaderboard[2].student_id).toBe(bob.id);
    expect(leaderboard[2].pools_predicted).toBe(1);
    expect(leaderboard[2].correct).toBe(0);
    expect(leaderboard[2].resolved_count).toBe(1);
    expect(leaderboard[2].accuracy).toBe(0);
    expect(leaderboard[2].net_points).toBe(-50);
  });

  test('member with predictions only on open pools: accuracy is null', async () => {
    const alice = await makeStudent('Alice');
    const bob = await makeStudent('Bob');

    const { circle, inviteToken } = await circlesService.createCircle('Open Pool Crew', alice.id);
    await circlesService.joinCircleByToken(inviteToken, bob.id);

    // Alice creates open pool
    const pool = await poolsService.createPool(circle.id, alice.id, {
      poolType: 'private',
      title: 'Open Pool',
      outcomeA: 'Yes',
      outcomeB: 'No',
      kickoffAt: new Date(Date.now() + 3600000).toISOString(),
      stakeAmount: 50,
    });

    // Bob predicts on the open pool
    await poolsService.predictInPool(pool.id, { studentId: bob.id }, 'Yes');

    const leaderboard = await circlesService.getLeaderboardForCircle(circle.id);
    const bobStats = leaderboard.find((m) => m.student_id === bob.id);
    expect(bobStats.pools_predicted).toBe(1);
    expect(bobStats.correct).toBe(0);
    expect(bobStats.resolved_count).toBe(0);
    expect(bobStats.accuracy).toBeNull(); // No resolved pools yet
    expect(bobStats.net_points).toBe(-50); // Locked but no payout yet
  });

  test('member with predictions on wrapping public pool (parent_market_id set): counts correctly', async () => {
    const alice = await makeStudent('Alice');
    const bob = await makeStudent('Bob');

    const { circle, inviteToken } = await circlesService.createCircle('Public Pool Crew', alice.id);
    await circlesService.joinCircleByToken(inviteToken, bob.id);

    // Create a multi_market
    const [market] = await db('multi_markets').insert({
      title: 'Test Multi Market',
      description: 'A test',
      status: 'open',
      closes_at: new Date(Date.now() + 3600000),
    }).returning('*');

    // Add outcomes to the market
    await db('multi_market_outcomes').insert([
      { market_id: market.id, label: 'Option A', shares_sold: 0 },
      { market_id: market.id, label: 'Option B', shares_sold: 0 },
    ]);

    // Create a public pool wrapping the market
    const pool = await poolsService.createPool(circle.id, alice.id, {
      poolType: 'public',
      parentMarketId: market.id,
      kickoffAt: new Date(Date.now() + 3600000).toISOString(),
      stakeAmount: 50,
    });

    // Alice predicts Option A, Bob predicts Option B
    await poolsService.predictInPool(pool.id, { studentId: alice.id }, 'Option A');
    await poolsService.predictInPool(pool.id, { studentId: bob.id }, 'Option B');

    // Resolve: Alice wins
    await db('circle_pools').where({ id: pool.id }).update({ status: 'resolved', winner_outcome: 'Option A' });
    await db('circle_pool_predictions').where({ pool_id: pool.id, student_id: alice.id }).update({ payout: 100 });
    await db('circle_pool_predictions').where({ pool_id: pool.id, student_id: bob.id }).update({ payout: 0 });

    const leaderboard = await circlesService.getLeaderboardForCircle(circle.id);
    const aliceStats = leaderboard.find((m) => m.student_id === alice.id);
    const bobStats = leaderboard.find((m) => m.student_id === bob.id);

    expect(aliceStats.pools_predicted).toBe(1);
    expect(aliceStats.correct).toBe(1);
    expect(aliceStats.accuracy).toBe(100);
    expect(aliceStats.net_points).toBe(50);

    expect(bobStats.pools_predicted).toBe(1);
    expect(bobStats.correct).toBe(0);
    expect(bobStats.accuracy).toBe(0);
    expect(bobStats.net_points).toBe(-50);
  });
});
