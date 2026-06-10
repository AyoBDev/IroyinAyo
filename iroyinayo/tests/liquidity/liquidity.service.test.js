// Pure math unit tests - no database required
// Override the global test setup to prevent database initialization
jest.mock('../../src/config/database', () => ({}));

const liquidityService = require('../../src/modules/liquidity/liquidity.service');

describe('Liquidity Service', () => {
  describe('findSharesForTargetPriceBinary', () => {
    test('calculates shares to move YES from 50% to 30%', () => {
      const result = liquidityService.findSharesForTargetPriceBinary(100, 100, 'no', 0.3);
      expect(result.shares).toBeGreaterThan(0);
      const newYesPrice = 100 / (100 + 100 + result.shares);
      expect(newYesPrice).toBeCloseTo(0.3, 1);
    });

    test('calculates shares to move YES from 50% to 70%', () => {
      const result = liquidityService.findSharesForTargetPriceBinary(100, 100, 'yes', 0.7);
      expect(result.shares).toBeGreaterThan(0);
      const newYesPrice = (100 + result.shares) / (100 + result.shares + 100);
      expect(newYesPrice).toBeCloseTo(0.7, 1);
    });

    test('returns 0 shares when already at target', () => {
      const result = liquidityService.findSharesForTargetPriceBinary(100, 100, 'yes', 0.5);
      expect(result.shares).toBeCloseTo(0, 0);
    });
  });

  describe('findSharesForTargetPriceMulti', () => {
    test('calculates shares to move outcome 0 from 33% to 50%', () => {
      const sharesSold = [0, 0, 0];
      const b = 100;
      const result = liquidityService.findSharesForTargetPriceMulti(sharesSold, b, 0, 0.50);
      expect(result.shares).toBeGreaterThan(0);
    });

    test('returns 0 shares when already at target', () => {
      const sharesSold = [0, 0, 0];
      const b = 100;
      const result = liquidityService.findSharesForTargetPriceMulti(sharesSold, b, 0, 1/3);
      expect(result.shares).toBeCloseTo(0, 0);
    });
  });
});
