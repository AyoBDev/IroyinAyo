import { supabase } from './lib/supabase.js';

const BASE = '';

class ApiError extends Error {
  constructor(message, { status, code, attemptsRemaining } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    if (typeof attemptsRemaining === 'number') this.attemptsRemaining = attemptsRemaining;
  }
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    const code = body && body.code;
    if (code === 'BOOTSTRAP_REQUIRED' || code === 'PIN_INVALID' || code === 'PIN_LOCKED' || code === 'NO_PIN') {
      throw new ApiError(code, {
        status: 401,
        code,
        attemptsRemaining: body && typeof body.attempts_remaining === 'number' ? body.attempts_remaining : undefined,
      });
    }
    // Generic 401 → sign out so the user is shown the auth modal.
    await supabase.auth.signOut();
    throw new ApiError('Unauthorized', { status: 401 });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(err.error || 'Request failed', {
      status: res.status,
      code: err.code,
    });
  }
  return res.json();
}

export { apiFetch, ApiError };
