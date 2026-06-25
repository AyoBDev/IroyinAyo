import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(msg, { code, status } = {}) { super(msg); this.code = code; this.status = status; }
  },
}));

import useStore from '../store.js';
import { apiFetch } from '../api.js';
import { supabase } from '../lib/supabase.js';

beforeEach(() => {
  vi.restoreAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

test('fetchUser stores has_pin: true from /me/info response', async () => {
  apiFetch.mockResolvedValue({ id: 'student-1', name: 'X', points_balance: 100, has_pin: true });
  await useStore.getState().fetchUser();
  expect(useStore.getState().user.has_pin).toBe(true);
});

test('fetchUser stores has_pin: false', async () => {
  apiFetch.mockResolvedValue({ id: 'student-1', name: 'X', points_balance: 100, has_pin: false });
  await useStore.getState().fetchUser();
  expect(useStore.getState().user.has_pin).toBe(false);
});
