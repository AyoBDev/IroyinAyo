import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(msg, { code, status } = {}) { super(msg); this.code = code; this.status = status; }
  },
}));

import AuthModal from '../components/NoAuth.jsx';
import { supabase } from '../lib/supabase.js';
import { apiFetch, ApiError } from '../api.js';

beforeEach(() => {
  vi.restoreAllMocks();
  supabase.auth.signInWithOtp.mockResolvedValue({ error: null });
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
});

test('email submit calls signInWithOtp and shows the code step', async () => {
  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'a@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => {
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { shouldCreateUser: true },
    });
  });
  expect(await screen.findByText(/verification code/i)).toBeInTheDocument();
});

test('returning user (me/info succeeds) reloads to the app', async () => {
  apiFetch.mockResolvedValue({ id: 'student-1', name: 'Tunde' });
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'a@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalled());

  const codeInput = await screen.findByPlaceholderText(/000000/);
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  await waitFor(() => {
    expect(supabase.auth.verifyOtp).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});

test('new user (BOOTSTRAP_REQUIRED) shows the name step', async () => {
  apiFetch.mockImplementation((path) => {
    if (path === '/api/multi-markets/me/info') {
      return Promise.reject(new ApiError('bootstrap', { code: 'BOOTSTRAP_REQUIRED', status: 401 }));
    }
    return Promise.resolve({ student: { id: 'x', name: 'X' } });
  });

  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'new@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalled());

  const codeInput = await screen.findByPlaceholderText(/000000/);
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  expect(await screen.findByPlaceholderText(/your name/i)).toBeInTheDocument();
});

test('Google button calls signInWithOAuth', () => {
  render(<AuthModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /google/i }));
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
});
