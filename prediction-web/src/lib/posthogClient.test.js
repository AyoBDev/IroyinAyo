import { describe, it, expect } from 'vitest';
import { capture } from './posthogClient.js';

describe('capture', () => {
  it('does not throw when not initialized', () => {
    expect(() => capture('test_event', { foo: 'bar' })).not.toThrow();
  });
});
