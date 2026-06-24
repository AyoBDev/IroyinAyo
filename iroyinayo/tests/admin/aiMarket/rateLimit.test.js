const rateLimit = require('../../../src/modules/admin/aiMarket/rateLimit');

describe('rateLimit', () => {
  beforeEach(() => {
    rateLimit._reset();
  });

  test('allows up to RATE_PER_MIN calls', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) {
      expect(rateLimit.consume('admin-a').ok).toBe(true);
    }
  });

  test('blocks the (RATE_PER_MIN+1)th call', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
    const r = rateLimit.consume('admin-a');
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test('isolates per admin', () => {
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
    expect(rateLimit.consume('admin-b').ok).toBe(true);
  });

  test('refills after 60 seconds', () => {
    const realNow = Date.now;
    let t = 5_000_000;
    Date.now = () => t;
    try {
      for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) rateLimit.consume('admin-a');
      expect(rateLimit.consume('admin-a').ok).toBe(false);
      t += 60_001;
      expect(rateLimit.consume('admin-a').ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  test('RATE_PER_MIN is 10', () => {
    expect(rateLimit.RATE_PER_MIN).toBe(10);
  });
});
