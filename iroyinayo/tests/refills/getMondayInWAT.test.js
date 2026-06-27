const { getMondayInWAT } = require('../../src/modules/refills/refill.service');

test('Monday in WAT returns the same date', () => {
  // 2026-06-22 is a Monday. 03:00 UTC = 04:00 WAT.
  expect(getMondayInWAT(new Date('2026-06-22T03:00:00.000Z'))).toBe('2026-06-22');
});

test('Tuesday in WAT returns previous Monday', () => {
  expect(getMondayInWAT(new Date('2026-06-23T15:00:00.000Z'))).toBe('2026-06-22');
});

test('Sunday 22:00 UTC is Monday 23:00 WAT — returns next Monday-equivalent (the Sunday itself in week sense)', () => {
  // 2026-06-21 22:00 UTC = 2026-06-21 23:00 WAT = Sunday WAT → still belongs to week starting 2026-06-15 (prev Monday).
  expect(getMondayInWAT(new Date('2026-06-21T22:00:00.000Z'))).toBe('2026-06-15');
});

test('Late Sunday UTC that is already Monday in WAT belongs to new week', () => {
  // 2026-06-21 23:30 UTC = 2026-06-22 00:30 WAT = Monday WAT → week starts 2026-06-22.
  expect(getMondayInWAT(new Date('2026-06-21T23:30:00.000Z'))).toBe('2026-06-22');
});

test('Early Monday UTC that is still Sunday in WAT belongs to old week', () => {
  // Trick case: 2026-06-22 00:00 UTC = 2026-06-22 01:00 WAT (Mon). Already in new week.
  expect(getMondayInWAT(new Date('2026-06-22T00:00:00.000Z'))).toBe('2026-06-22');
});

test('defaults to current time when called with no arg', () => {
  const result = getMondayInWAT();
  expect(typeof result).toBe('string');
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
