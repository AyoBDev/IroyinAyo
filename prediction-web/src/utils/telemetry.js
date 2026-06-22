export function track(event, properties = {}) {
  try {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[telemetry] ${event}`, properties);
    }
  } catch (_) {
    // never throw
  }
}
