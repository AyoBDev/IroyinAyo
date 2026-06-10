const adminAdapter = require('../../src/modules/liquidity/adapters/admin.adapter');
const oddsApiAdapter = require('../../src/modules/liquidity/adapters/oddsApi.adapter');

describe('Admin Adapter', () => {
  test('getFairValues returns target_probabilities from config', async () => {
    const config = {
      target_probabilities: { yes: 0.3, no: 0.7 },
    };
    const result = await adminAdapter.getFairValues(config);
    expect(result).toEqual({ yes: 0.3, no: 0.7 });
  });

  test('getFairValues handles stringified JSON', async () => {
    const config = {
      target_probabilities: '{"yes":0.25,"no":0.75}',
    };
    const result = await adminAdapter.getFairValues(config);
    expect(result).toEqual({ yes: 0.25, no: 0.75 });
  });
});

describe('Odds API Adapter', () => {
  beforeEach(() => {
    process.env.ODDS_API_KEY = 'test-key';
    oddsApiAdapter._clearCache();
  });

  afterEach(() => {
    delete process.env.ODDS_API_KEY;
  });

  test('convertOddsToProbabilities normalizes decimal odds', () => {
    const odds = [
      { name: 'Home', price: 2.0 },
      { name: 'Draw', price: 3.5 },
      { name: 'Away', price: 4.0 },
    ];
    const result = oddsApiAdapter.convertOddsToProbabilities(odds);
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
    expect(result['Home']).toBeGreaterThan(result['Draw']);
    expect(result['Draw']).toBeGreaterThan(result['Away']);
  });

  test('convertOddsToProbabilities handles 2-outcome markets', () => {
    const odds = [
      { name: 'Over', price: 1.8 },
      { name: 'Under', price: 2.1 },
    ];
    const result = oddsApiAdapter.convertOddsToProbabilities(odds);
    expect(Object.keys(result).length).toBe(2);
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  test('getFairValues uses cache within TTL', async () => {
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return { ok: true, json: async () => ({ bookmakers: [{ markets: [{ key: 'h2h', outcomes: [{ name: 'Home', price: 2.0 }, { name: 'Away', price: 2.0 }] }] }] }) };
    };
    oddsApiAdapter._setFetchFn(mockFetch);

    const config = { odds_api_event_id: 'evt1', odds_api_market_key: 'h2h', target_probabilities: {} };
    await oddsApiAdapter.getFairValues(config);
    await oddsApiAdapter.getFairValues(config);
    expect(fetchCount).toBe(1);
  });

  test('getFairValues falls back to target_probabilities on API error', async () => {
    const mockFetch = async () => { throw new Error('network error'); };
    oddsApiAdapter._setFetchFn(mockFetch);

    const config = {
      odds_api_event_id: 'evt1',
      odds_api_market_key: 'h2h',
      target_probabilities: { Home: 0.6, Away: 0.4 },
    };
    const result = await oddsApiAdapter.getFairValues(config);
    expect(result).toEqual({ Home: 0.6, Away: 0.4 });
  });
});
