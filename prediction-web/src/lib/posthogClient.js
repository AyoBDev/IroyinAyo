import posthog from 'posthog-js';

let initialized = false;

export function initPosthog() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  posthog.init(key, { api_host: host, capture_pageview: true, persistence: 'localStorage' });
  initialized = true;
}

export function capture(event, properties) {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // never throw from analytics
  }
}
