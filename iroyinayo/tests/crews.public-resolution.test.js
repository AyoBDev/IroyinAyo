/**
 * End-to-end test for the multi_markets → crew_pool auto-resolution path.
 *
 * After the refactor (migration 042), public crew pools wrap a multi_markets
 * row instead of a Football-Data fixture. When the parent market resolves
 * via multiMarkets.resolveMarket(), the resolveMarket function cascades to
 * any crew pools wrapping that market and applies payouts via
 * resolution.autoResolvePublicPool().
 *
 * This test stands up a market, a crew with members, a public crew pool
 * wrapping the market, predictions on different outcomes, then resolves the
 * market and asserts the crew pool payouts arrived correctly.
 */
const db = require('../src/config/database');
const crewsService = require('../src/modules/crews/service');
const poolsService = require('../src/modules/crews/pools.service');
const multiMarketsService = require('../src/modules/markets/multiMarkets.service');

async function makeStudent(name, balance = 1000) {
  const [s] = await db('students').insert({
    name,
    phone_number: `${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
    is_onboarded: true, is_banned: false, is_system: false,
    points_balance: balance,
  }).returning('*');
  return s;
}

describe('Crew public pool auto-resolution via multi_markets', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => {
    await db('crew_pool_predictions').del();
    await db('crew_pool_resolutions').del();
    await db('crew_pools').del();
    await db('crew_invites').del();
    await db('crew_members').del();
    await db('crews').del();
    await db('multi_market_positions').del();
    await db('multi_market_outcomes').del();
    await db('multi_markets').del();
    await db('point_transactions').del();
    await db('students').del();
  });

  test('resolving the wrapped multi_market pays out winners in the crew pool', async () => {
    // 1. Set up a multi_market with two outcomes
    const market = await multiMarketsService.createMarket('Arsenal vs Chelsea', 50);
    const arsenal = await multiMarketsService.addOutcome(market.id, 'Arsenal');
    const chelsea = await multiMarketsService.addOutcome(market.id, 'Chelsea');

    // 2. Set up a crew with 3 members and a public pool wrapping the market
    const creator = await makeStudent('Creator');
    const { crew, inviteToken } = await crewsService.createCrew('FC', creator.id);
    const m1 = await makeStudent('M1');
    const m2 = await makeStudent('M2');
    await crewsService.joinCrewByToken(inviteToken, m1.id);
    await crewsService.joinCrewByToken(inviteToken, m2.id);

    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'public',
      parentMarketId: market.id,
      kickoffAt: new Date(Date.now() + 3600 * 1000),
      stakeAmount: 100,
    });
    expect(pool.parent_market_id).toBe(market.id);

    // 3. Predictions: creator and m1 pick Arsenal, m2 picks Chelsea
    await poolsService.predictInPool(pool.id, { studentId: creator.id }, 'Arsenal');
    await poolsService.predictInPool(pool.id, { studentId: m1.id }, 'Arsenal');
    await poolsService.predictInPool(pool.id, { studentId: m2.id }, 'Chelsea');

    // 4. Force-close the pool (kickoff cron normally does this; simulate it)
    await db('crew_pools').where({ id: pool.id }).update({ status: 'closed' });

    // 5. Resolve the multi_market → cascade should resolve the crew pool
    await multiMarketsService.resolveMarket(market.id, arsenal.id);

    // 6. Pot = 300, 2 winners, each gets floor(300/2) = 150
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
    expect(finalPool.winner_outcome).toBe('Arsenal');
  });

  test('createPool rejects when wrapped market is no longer open', async () => {
    const market = await multiMarketsService.createMarket('Test market', 25);
    const o1 = await multiMarketsService.addOutcome(market.id, 'Yes');
    await multiMarketsService.addOutcome(market.id, 'No');
    // Manually close the market (status would normally be 'resolved' or 'closed')
    await db('multi_markets').where({ id: market.id }).update({ status: 'resolved', winning_outcome_id: o1.id });

    const creator = await makeStudent('Creator');
    const { crew } = await crewsService.createCrew('FC', creator.id);
    await expect(poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: market.id,
      kickoffAt: new Date(Date.now() + 3600 * 1000), stakeAmount: 50,
    })).rejects.toMatchObject({ code: 'MARKET_NOT_OPEN' });
  });

  test('createPool rejects unknown market id', async () => {
    const creator = await makeStudent('Creator');
    const { crew } = await crewsService.createCrew('FC', creator.id);
    // Random UUID that isn't in multi_markets
    await expect(poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: '00000000-0000-0000-0000-000000000000',
      kickoffAt: new Date(Date.now() + 3600 * 1000), stakeAmount: 50,
    })).rejects.toMatchObject({ code: 'MARKET_NOT_FOUND' });
  });

  test('predictInPool rejects a label that is not an outcome of the wrapped market', async () => {
    const market = await multiMarketsService.createMarket('Three-way', 25);
    await multiMarketsService.addOutcome(market.id, 'A');
    await multiMarketsService.addOutcome(market.id, 'B');
    await multiMarketsService.addOutcome(market.id, 'C');

    const creator = await makeStudent('Creator');
    const { crew, inviteToken } = await crewsService.createCrew('FC', creator.id);
    const m1 = await makeStudent('M1');
    await crewsService.joinCrewByToken(inviteToken, m1.id);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: market.id,
      kickoffAt: new Date(Date.now() + 3600 * 1000), stakeAmount: 50,
    });
    await expect(poolsService.predictInPool(pool.id, { studentId: m1.id }, 'home'))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });

  test('getPoolDetail surfaces market outcomes for public pools', async () => {
    const market = await multiMarketsService.createMarket('Outcomes test', 25);
    await multiMarketsService.addOutcome(market.id, 'Alpha');
    await multiMarketsService.addOutcome(market.id, 'Beta');

    const creator = await makeStudent('Creator');
    const { crew } = await crewsService.createCrew('FC', creator.id);
    const pool = await poolsService.createPool(crew.id, creator.id, {
      poolType: 'public', parentMarketId: market.id,
      kickoffAt: new Date(Date.now() + 3600 * 1000), stakeAmount: 50,
    });
    const detail = await poolsService.getPoolDetail(pool.id, creator.id);
    expect(detail.marketOutcomes).toBeDefined();
    expect(detail.marketOutcomes.map((o) => o.label).sort()).toEqual(['Alpha', 'Beta']);
    expect(detail.parentMarket).toBeDefined();
    expect(detail.parentMarket.title).toBe('Outcomes test');
  });
});
