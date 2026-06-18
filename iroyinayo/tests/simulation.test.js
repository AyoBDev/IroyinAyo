const { shouldTrigger, reset } = require('../src/modules/simulation/triggers');

// Import only pure functions from engine (mock the DB-dependent module)
jest.mock('../src/config/database', () => ({}));
jest.mock('../src/modules/liquidity/adapters/oddsApi.adapter', () => ({ getFairValues: jest.fn() }));
const { generatePath, weightedRandom, computeResults } = require('../src/modules/simulation/engine');

describe('Monte Carlo Engine', () => {
  describe('weightedRandom', () => {
    it('returns valid index for uniform weights', () => {
      const weights = [0.25, 0.25, 0.25, 0.25];
      for (let i = 0; i < 100; i++) {
        const idx = weightedRandom(weights);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(weights.length);
      }
    });

    it('handles zero weights', () => {
      const weights = [0, 0, 0];
      const idx = weightedRandom(weights);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    });

    it('strongly favors high-weight outcome', () => {
      const weights = [0.99, 0.005, 0.005];
      const counts = [0, 0, 0];
      for (let i = 0; i < 1000; i++) {
        counts[weightedRandom(weights)]++;
      }
      expect(counts[0]).toBeGreaterThan(900);
    });
  });

  describe('computeResults', () => {
    it('calculates mean probabilities and confidence intervals', () => {
      const outcomes = [
        { id: '1', label: 'Yes' },
        { id: '2', label: 'No' },
      ];
      const allFinalPrices = Array.from({ length: 100 }, () => [0.7, 0.3]);
      const { outcomes: results, confidenceScore } = computeResults(allFinalPrices, outcomes);

      expect(results[0].mean_prob).toBeCloseTo(0.7, 1);
      expect(results[1].mean_prob).toBeCloseTo(0.3, 1);
      expect(confidenceScore).toBeGreaterThan(0.5);
    });

    it('returns lower confidence for high variance', () => {
      const outcomes = [
        { id: '1', label: 'Yes' },
        { id: '2', label: 'No' },
      ];
      const allFinalPrices = Array.from({ length: 100 }, (_, i) =>
        i < 50 ? [0.9, 0.1] : [0.3, 0.7]
      );
      const { confidenceScore: highVariance } = computeResults(allFinalPrices, outcomes);

      const uniform = Array.from({ length: 100 }, () => [0.8, 0.2]);
      const { confidenceScore: lowVariance } = computeResults(uniform, outcomes);

      expect(lowVariance).toBeGreaterThan(highVariance);
    });
  });

  describe('generatePath', () => {
    it('returns valid probabilities that sum to ~1', () => {
      const sharesSold = [100, 100];
      const b = 50;
      const outcomes = [{ id: '1' }, { id: '2' }];
      const tradingProfile = { avgAmount: 10, volumePerStep: 1, directionalBias: [0.5, 0.5] };

      const result = generatePath(sharesSold, b, outcomes, 5, null, 0, tradingProfile);

      expect(result.length).toBe(2);
      const sum = result.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1, 1);
      result.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('Triggers', () => {
  beforeEach(() => reset());

  it('triggers on large price swing', () => {
    const result = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    expect(result).toBe(true);
  });

  it('does not trigger on small price swing', () => {
    const result = shouldTrigger('market-1', 'trade', { priceSwing: 0.05 });
    expect(result).toBe(false);
  });

  it('debounces repeated triggers', () => {
    const first = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    const second = shouldTrigger('market-1', 'trade', { priceSwing: 0.15 });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('triggers on external data change', () => {
    const result = shouldTrigger('market-3', 'external_data_changed', {});
    expect(result).toBe(true);
  });

  it('triggers on near close', () => {
    const result = shouldTrigger('market-4', 'near_close', {});
    expect(result).toBe(true);
  });
});
