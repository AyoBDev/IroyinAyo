const { normalizePhone, isValidNigerianNumber } = require('../../src/modules/auth/phone');

describe('normalizePhone', () => {
  test('rewrites leading 0 to 234', () => {
    expect(normalizePhone('08012345678')).toBe('2348012345678');
  });

  test('strips formatting characters', () => {
    expect(normalizePhone('+234 801 234 5678')).toBe('2348012345678');
  });

  test('leaves already-normalized number unchanged', () => {
    expect(normalizePhone('2348012345678')).toBe('2348012345678');
  });

  test('prefixes 234 when missing', () => {
    expect(normalizePhone('8012345678')).toBe('2348012345678');
  });

  test('handles null and undefined input', () => {
    expect(normalizePhone('')).toBe('234');
    expect(normalizePhone(null)).toBe('234');
    expect(normalizePhone(undefined)).toBe('234');
  });
});

describe('isValidNigerianNumber', () => {
  test('accepts a valid MTN-style number (carrier digit 8)', () => {
    expect(isValidNigerianNumber('2348012345678')).toBe(true);
  });

  test('accepts a valid 7-prefix number', () => {
    expect(isValidNigerianNumber('2347012345678')).toBe(true);
  });

  test('accepts a valid 9-prefix number', () => {
    expect(isValidNigerianNumber('2349012345678')).toBe(true);
  });

  test('rejects a wrong carrier digit', () => {
    expect(isValidNigerianNumber('2341012345678')).toBe(false);
  });

  test('rejects a too-short number', () => {
    expect(isValidNigerianNumber('234801234')).toBe(false);
  });

  test('rejects a too-long number', () => {
    expect(isValidNigerianNumber('23480123456789')).toBe(false);
  });

  test('rejects a non-Nigerian number (US E.164 without +)', () => {
    expect(isValidNigerianNumber('14155551234')).toBe(false);
  });
});
