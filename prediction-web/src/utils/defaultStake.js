export const STAKE_FLOOR = 100;
export const STAKE_CEILING = 1000;
export const NEW_USER_DEFAULT = 200;

export function computeDefaultStake({ recentStakes = [], balance = 0 }) {
  const ceiling = Math.min(STAKE_CEILING, Math.floor(balance * 0.10 / 50) * 50);
  if (recentStakes.length < 3) return Math.min(NEW_USER_DEFAULT, Math.max(STAKE_FLOOR, ceiling));
  const sorted = [...recentStakes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const rounded = Math.round(median / 50) * 50;
  return Math.min(ceiling, Math.max(STAKE_FLOOR, rounded));
}
