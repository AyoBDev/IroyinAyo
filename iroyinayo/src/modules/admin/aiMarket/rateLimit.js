const RATE_PER_MIN = 10;
const WINDOW_MS = 60_000;
// In-process bucket: per-worker, not shared. Effective limit scales with worker
// count if the backend ever runs in cluster mode. Swap for Redis/PG if that happens.
const _buckets = new Map(); // adminId → array of timestamps within the window

function consume(adminId) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = (_buckets.get(adminId) || []).filter((ts) => ts > cutoff);
  if (existing.length >= RATE_PER_MIN) {
    const oldestInWindow = existing[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    _buckets.set(adminId, existing);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }
  existing.push(now);
  _buckets.set(adminId, existing);
  return { ok: true };
}

function _reset() {
  _buckets.clear();
}

module.exports = { RATE_PER_MIN, consume, _reset };
