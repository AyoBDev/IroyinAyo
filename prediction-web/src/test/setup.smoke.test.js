import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('has localStorage', () => {
    localStorage.setItem('x', '1');
    expect(localStorage.getItem('x')).toBe('1');
  });
});
