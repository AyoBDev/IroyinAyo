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
import { apiFetch, ApiError } from '../api.js';
import { supabase } from '../lib/supabase.js';

beforeEach(() => {
  vi.restoreAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  useStore.setState({ user: { id: 'u1', points_balance: 0, has_pin: true }, pendingRefill: null, refillsRemaining: 3 });
});

test('fetchPendingRefill stores pending refill from API', async () => {
  apiFetch.mockResolvedValue({ pending: { id: 'p1', amount: 80 }, refillsRemaining: 2 });
  await useStore.getState().fetchPendingRefill();
  expect(useStore.getState().pendingRefill).toEqual({ id: 'p1', amount: 80 });
  expect(useStore.getState().refillsRemaining).toBe(2);
});

test('fetchPendingRefill stores null when no pending', async () => {
  apiFetch.mockResolvedValue({ pending: null, refillsRemaining: 3 });
  await useStore.getState().fetchPendingRefill();
  expect(useStore.getState().pendingRefill).toBe(null);
});

test('claimRefill on success updates balance and clears pendingRefill', async () => {
  useStore.setState({ pendingRefill: { id: 'p1', amount: 80 } });
  apiFetch.mockResolvedValue({ ok: true, amount: 80, newBalance: 80 });
  await useStore.getState().claimRefill('p1');
  expect(useStore.getState().pendingRefill).toBe(null);
  expect(useStore.getState().user.points_balance).toBe(80);
});

test('claimRefill on ALREADY_CLAIMED clears pendingRefill without throwing', async () => {
  useStore.setState({ pendingRefill: { id: 'p1', amount: 80 } });
  apiFetch.mockRejectedValue(new ApiError('claimed', { code: 'ALREADY_CLAIMED', status: 400 }));
  await useStore.getState().claimRefill('p1');
  expect(useStore.getState().pendingRefill).toBe(null);
});

test('claimRefill on other error rethrows and keeps pendingRefill', async () => {
  useStore.setState({ pendingRefill: { id: 'p1', amount: 80 } });
  apiFetch.mockRejectedValue(new Error('Network down'));
  await expect(useStore.getState().claimRefill('p1')).rejects.toThrow(/Network down/);
  expect(useStore.getState().pendingRefill).toEqual({ id: 'p1', amount: 80 });
});
