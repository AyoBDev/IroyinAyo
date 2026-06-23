'use client';

let initialized = false;
let warned = false;

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      if (!warned && process.env.NODE_ENV !== 'production') {
        warned = true;
        console.warn('[telemetry] disabled — set NEXT_PUBLIC_POSTHOG_KEY to enable PostHog events');
      }
      return;
    }
    const posthog = require('posthog-js');
    posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com' });
  } catch (_) { /* swallow */ }
}

export function track(event, properties = {}) {
  ensureInit();
  try {
    if (typeof window === 'undefined') return;
    const posthog = require('posthog-js');
    posthog.capture(event, properties);
  } catch (_) {
    if (typeof console !== 'undefined') console.debug('[telemetry]', event, properties);
  }
}
