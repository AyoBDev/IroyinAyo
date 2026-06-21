export const STAKE_FLOOR = 100;
export const STAKE_CEILING = 1000;
export const NEW_USER_DEFAULT = 200;

export function computeEffectiveCeiling(balance) {
  if (balance < STAKE_FLOOR) return Math.floor(balance / 50) * 50;
  const raw = Math.min(STAKE_CEILING, Math.floor(balance * 0.10 / 50) * 50);
  return raw < STAKE_FLOOR ? STAKE_FLOOR : raw;
}

export function computeDefaultStake({ recentStakes = [], balance = 0 }) {
  // Low balance: auto-shrink to the largest allowed stake (multiple of 50)
  if (balance < STAKE_FLOOR) return Math.floor(balance / 50) * 50;

  const ceiling = Math.min(STAKE_CEILING, Math.floor(balance * 0.10 / 50) * 50);
  // Edge case: balance >= STAKE_FLOOR but balance * 0.10 rounded down to 50 = 0.
  // E.g., balance = 100 → 100 * 0.10 / 50 = 0.2 → floor = 0 → ceiling = 0.
  // In that case clamp to STAKE_FLOOR so we don't return below floor.
  const effectiveCeiling = ceiling < STAKE_FLOOR ? STAKE_FLOOR : ceiling;

  if (recentStakes.length < 3) return Math.min(NEW_USER_DEFAULT, effectiveCeiling);
  const sorted = [...recentStakes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const rounded = Math.round(median / 50) * 50;
  return Math.min(effectiveCeiling, Math.max(STAKE_FLOOR, rounded));
}
