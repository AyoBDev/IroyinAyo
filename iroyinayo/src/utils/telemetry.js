function track(event, properties = {}) {
  try {
    console.log(`[TELEMETRY] ${event}`, properties);
  } catch (_) {
    // never throw
  }
}

module.exports = { track };
