const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_MS || '60000', 10);
const PRICE_SWING_THRESHOLD = 0.10;
const VOLUME_SPIKE_COUNT = 5;
const VOLUME_SPIKE_WINDOW_MS = 5 * 60 * 1000;

const pendingSimulations = new Map();
const recentTrades = new Map();

function shouldTrigger(marketId, eventType, data) {
  if (eventType === 'trade') {
    trackTrade(marketId);

    if (data.priceSwing && Math.abs(data.priceSwing) > PRICE_SWING_THRESHOLD) {
      return scheduleSimulation(marketId);
    }

    if (hasVolumeSpike(marketId)) {
      return scheduleSimulation(marketId);
    }
  }

  if (eventType === 'external_data_changed') {
    return scheduleSimulation(marketId);
  }

  if (eventType === 'near_close') {
    return scheduleSimulation(marketId);
  }

  return false;
}

function trackTrade(marketId) {
  const now = Date.now();
  if (!recentTrades.has(marketId)) {
    recentTrades.set(marketId, []);
  }
  const trades = recentTrades.get(marketId);
  trades.push(now);

  const cutoff = now - VOLUME_SPIKE_WINDOW_MS;
  const filtered = trades.filter((t) => t > cutoff);
  recentTrades.set(marketId, filtered);
}

function hasVolumeSpike(marketId) {
  const trades = recentTrades.get(marketId) || [];
  return trades.length >= VOLUME_SPIKE_COUNT;
}

function scheduleSimulation(marketId) {
  if (pendingSimulations.has(marketId)) {
    return false;
  }

  pendingSimulations.set(marketId, true);
  setTimeout(() => {
    pendingSimulations.delete(marketId);
  }, DEBOUNCE_MS);

  return true;
}

function isDebounced(marketId) {
  return pendingSimulations.has(marketId);
}

function reset() {
  pendingSimulations.clear();
  recentTrades.clear();
}

module.exports = { shouldTrigger, isDebounced, reset, trackTrade, hasVolumeSpike };
