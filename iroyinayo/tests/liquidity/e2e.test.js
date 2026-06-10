const db = require('../../src/config/database');
const marketsService = require('../../src/modules/markets/markets.service');
const multiMarketsService = require('../../src/modules/markets/multiMarkets.service');
const liquidityConfig = require('../../src/modules/liquidity/liquidity.config');
const liquidityService = require('../../src/modules/liquidity/liquidity.service');

describe('Liquidity Bot E2E', () => {
  let systemId;
  let studentId;

  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db('market_liquidity_config').del();
    await db('multi_market_positions').del();
    await db('multi_market_outcomes').del();
    await db('multi_markets').del();
    await db('market_positions').del();
    await db('markets').del();
    await db('point_transactions').del();
    await db('students').del();

    const [sys] = await db('students').insert({
      name: 'IroyinMarket', phone_number: 'system',
      is_system: true, points_balance: 999999,
      is_onboarded: true, is_verified: false, is_banned: false,
    }).returning('id');
    systemId = sys.id;

    const [student] = await db('students').insert({
      name: 'Trader', phone_number: '+2340000000001',
      points_balance: 1000, is_onboarded: true,
      is_verified: true, is_banned: false,
    }).returning('id');
    studentId = student.id;
  });

  test('full binary flow: create market → configure → seed → user trades → bot corrects', async () => {
    const market = await marketsService.create({
      question: 'Will Nigeria beat Argentina?',
      description: 'World Cup match',
      category: 'football',
      closes_at: new Date(Date.now() + 86400000),
      created_by_type: 'admin',
      created_by_id: systemId,
    });

    expect(market.yes_price).toBeCloseTo(0.5, 1);

    await liquidityConfig.create({
      market_id: market.id,
      source_type: 'admin',
      target_probabilities: { yes: 0.25, no: 0.75 },
      drift_threshold: 0.05,
      cooldown_seconds: 0,
    });

    await liquidityService.seed(market.id, 'binary');
    const seeded = await db('markets').where({ id: market.id }).first();
    const seededYesPrice = seeded.yes_pool / (seeded.yes_pool + seeded.no_pool);
    expect(seededYesPrice).toBeCloseTo(0.25, 1);

    await marketsService.buyPosition(market.id, studentId, 'yes', 50);
    const afterUserTrade = await db('markets').where({ id: market.id }).first();
    const priceAfterUser = afterUserTrade.yes_pool / (afterUserTrade.yes_pool + afterUserTrade.no_pool);
    expect(priceAfterUser).toBeGreaterThan(0.25);

    const result = await liquidityService.evaluate(market.id, 'binary', studentId);
    expect(result.action).toBe('corrected');
    expect(result.side).toBe('no');

    const afterBot = await db('markets').where({ id: market.id }).first();
    const priceAfterBot = afterBot.yes_pool / (afterBot.yes_pool + afterBot.no_pool);
    expect(priceAfterBot).toBeLessThan(priceAfterUser);
    expect(priceAfterBot).toBeGreaterThan(0.25);
  });

  test('full multi-outcome flow: create → configure → seed → user trades → bot corrects', async () => {
    const market = await multiMarketsService.createMarket('Who wins Group A?', 100);
    const outcomes = [];
    for (const label of ['Brazil', 'Mexico', 'Serbia', 'Cameroon']) {
      const outcome = await multiMarketsService.addOutcome(market.id, label);
      outcomes.push(outcome);
    }

    const targets = {};
    targets[outcomes[0].id] = 0.45;
    targets[outcomes[1].id] = 0.25;
    targets[outcomes[2].id] = 0.18;
    targets[outcomes[3].id] = 0.12;

    await liquidityConfig.create({
      multi_market_id: market.id,
      source_type: 'admin',
      target_probabilities: targets,
      drift_threshold: 0.05,
      cooldown_seconds: 0,
    });

    await liquidityService.seed(market.id, 'multi');

    const { calculatePrices } = multiMarketsService;
    let outs = await db('multi_market_outcomes').where({ market_id: market.id }).orderBy('created_at', 'asc');
    let prices = calculatePrices(outs.map(o => o.shares_sold), 100);
    expect(prices[0]).toBeCloseTo(0.45, 1);

    await multiMarketsService.buyPosition(market.id, outcomes[3].id, studentId, 80);

    outs = await db('multi_market_outcomes').where({ market_id: market.id }).orderBy('created_at', 'asc');
    prices = calculatePrices(outs.map(o => o.shares_sold), 100);
    expect(prices[3]).toBeGreaterThan(0.12);

    const result = await liquidityService.evaluate(market.id, 'multi', studentId);
    expect(result.action).toBe('corrected');
    expect(result.amount).toBeGreaterThan(0);
  });
});
