import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { apiFetch, ApiError } from '../api.js';
import { supabase } from '../lib/supabase.js';

beforeEach(() => {
  vi.restoreAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

test('sends Bearer token from supabase session', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  });
  await apiFetch('/api/x');
  expect(global.fetch).toHaveBeenCalledWith('/api/x', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
  }));
});

test('401 BOOTSTRAP_REQUIRED throws ApiError with code', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'x', code: 'BOOTSTRAP_REQUIRED' }),
  });
  await expect(apiFetch('/api/x')).rejects.toMatchObject({
    code: 'BOOTSTRAP_REQUIRED',
    status: 401,
  });
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});

test('generic 401 signs out', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'expired' }),
  });
  await expect(apiFetch('/api/x')).rejects.toThrow();
  expect(supabase.auth.signOut).toHaveBeenCalled();
});
