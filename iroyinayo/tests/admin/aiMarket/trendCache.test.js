const trendCache = require('../../../src/modules/admin/aiMarket/trendCache');

describe('trendCache', () => {
  beforeEach(() => {
    trendCache._reset(); // clear in-memory state between tests
  });

  test('returns null when nothing cached', () => {
    expect(trendCache.get('admin-a')).toBeNull();
  });

  test('returns cached value after set', () => {
    trendCache.set('admin-a', { trends: [{ title: 'x' }] });
    expect(trendCache.get('admin-a')).toEqual({ trends: [{ title: 'x' }] });
  });

  test('isolates per admin', () => {
    trendCache.set('admin-a', { trends: [{ title: 'a' }] });
    trendCache.set('admin-b', { trends: [{ title: 'b' }] });
    expect(trendCache.get('admin-a').trends[0].title).toBe('a');
    expect(trendCache.get('admin-b').trends[0].title).toBe('b');
  });

  test('expires after TTL', () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      trendCache.set('admin-a', { x: 1 });
      expect(trendCache.get('admin-a')).toEqual({ x: 1 });
      t += trendCache.TTL_MS + 1;
      expect(trendCache.get('admin-a')).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  test('TTL_MS is 60000', () => {
    expect(trendCache.TTL_MS).toBe(60_000);
  });
});
