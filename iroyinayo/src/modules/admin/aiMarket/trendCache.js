const TTL_MS = 60_000;
const _cache = new Map(); // adminId → { value, expiresAt }

function get(adminId) {
  const entry = _cache.get(adminId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(adminId);
    return null;
  }
  return entry.value;
}

function set(adminId, value) {
  _cache.set(adminId, { value, expiresAt: Date.now() + TTL_MS });
}

function _reset() {
  _cache.clear();
}

module.exports = { TTL_MS, get, set, _reset };
