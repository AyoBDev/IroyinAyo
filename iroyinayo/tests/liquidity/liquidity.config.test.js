const db = require('../../src/config/database');
const liquidityConfig = require('../../src/modules/liquidity/liquidity.config');

describe('Liquidity Config', () => {
  let marketId;
  let multiMarketId;

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
    await db('students').del();

    const [market] = await db('markets').insert({
      question: 'Test?', status: 'open', yes_pool: 100, no_pool: 100,
      liquidity: 100, closes_at: new Date(Date.now() + 86400000),
    }).returning('id');
    marketId = market.id;

    const [mm] = await db('multi_markets').insert({
      title: 'Multi test', liquidity_b: 50, status: 'open',
    }).returning('id');
    multiMarketId = mm.id;
  });

  test('createForBinaryMarket inserts config and returns it', async () => {
    const config = await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.3, no: 0.7 },
    });
    expect(config.id).toBeDefined();
    expect(config.market_id).toBe(marketId);
    expect(config.multi_market_id).toBeNull();
    expect(config.target_probabilities).toEqual({ yes: 0.3, no: 0.7 });
    expect(parseFloat(config.drift_threshold)).toBeCloseTo(0.10);
    expect(parseFloat(config.correction_strength)).toBeCloseTo(0.50);
  });

  test('createForMultiMarket inserts config', async () => {
    const config = await liquidityConfig.create({
      multi_market_id: multiMarketId,
      source_type: 'odds_api',
      target_probabilities: { a: 0.5, b: 0.3, c: 0.2 },
      odds_api_event_id: 'evt123',
      odds_api_market_key: 'h2h',
      drift_threshold: 0.05,
    });
    expect(config.multi_market_id).toBe(multiMarketId);
    expect(config.odds_api_event_id).toBe('evt123');
    expect(parseFloat(config.drift_threshold)).toBeCloseTo(0.05);
  });

  test('getByMarketId returns config for binary market', async () => {
    await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.4, no: 0.6 },
    });
    const found = await liquidityConfig.getByMarketId(marketId);
    expect(found).not.toBeNull();
    expect(found.market_id).toBe(marketId);
  });

  test('getByMultiMarketId returns config for multi market', async () => {
    await liquidityConfig.create({
      multi_market_id: multiMarketId,
      source_type: 'admin',
      target_probabilities: { a: 0.5, b: 0.5 },
    });
    const found = await liquidityConfig.getByMultiMarketId(multiMarketId);
    expect(found).not.toBeNull();
    expect(found.multi_market_id).toBe(multiMarketId);
  });

  test('getByMarketId returns null if no config', async () => {
    const found = await liquidityConfig.getByMarketId(marketId);
    expect(found).toBeNull();
  });

  test('update modifies fields', async () => {
    const config = await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.5, no: 0.5 },
    });
    const updated = await liquidityConfig.update(config.id, {
      target_probabilities: { yes: 0.3, no: 0.7 },
      drift_threshold: 0.15,
    });
    expect(updated.target_probabilities).toEqual({ yes: 0.3, no: 0.7 });
    expect(parseFloat(updated.drift_threshold)).toBeCloseTo(0.15);
  });

  test('remove deletes config', async () => {
    const config = await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.5, no: 0.5 },
    });
    await liquidityConfig.remove(config.id);
    const found = await liquidityConfig.getByMarketId(marketId);
    expect(found).toBeNull();
  });

  test('listAll returns all configs', async () => {
    await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.5, no: 0.5 },
    });
    await liquidityConfig.create({
      multi_market_id: multiMarketId,
      source_type: 'admin',
      target_probabilities: { a: 0.5, b: 0.5 },
    });
    const all = await liquidityConfig.listAll();
    expect(all.length).toBe(2);
  });

  test('updateLastCorrectionAt sets timestamp', async () => {
    const config = await liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.5, no: 0.5 },
    });
    await liquidityConfig.updateLastCorrectionAt(config.id);
    const found = await liquidityConfig.getByMarketId(marketId);
    expect(found.last_correction_at).not.toBeNull();
  });

  test('rejects target_probabilities that do not sum to ~1', async () => {
    await expect(liquidityConfig.create({
      market_id: marketId,
      source_type: 'admin',
      target_probabilities: { yes: 0.3, no: 0.3 },
    })).rejects.toThrow(/sum to 1/i);
  });
});
