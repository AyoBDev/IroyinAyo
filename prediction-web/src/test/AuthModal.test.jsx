import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
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
  sessionStorage.clear();
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

test('returning user with PIN shows pin step', async () => {
  apiFetch.mockResolvedValue({ id: 'student-1', name: 'Tunde', has_pin: true });

  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'a@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalled());

  const codeInput = await screen.findByPlaceholderText(/000000/);
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  await waitFor(() => {
    expect(supabase.auth.verifyOtp).toHaveBeenCalled();
  });
  expect(await screen.findByText(/enter your pin to unlock/i)).toBeInTheDocument();
});


test('Google button calls signInWithOAuth', () => {
  render(<AuthModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /google/i }));
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
});

test('shows signup-details step on BOOTSTRAP_REQUIRED with phone and pin fields', async () => {
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
  expect(screen.getByPlaceholderText(/phone/i)).toBeInTheDocument();
  expect(screen.getAllByPlaceholderText(/pin/i).length).toBeGreaterThanOrEqual(2); // pin + confirm
});

test('signup-details submits all four fields to bootstrap', async () => {
  apiFetch.mockImplementation((path) => {
    if (path === '/api/multi-markets/me/info') {
      return Promise.reject(new ApiError('bootstrap', { code: 'BOOTSTRAP_REQUIRED', status: 401 }));
    }
    if (path === '/api/auth/bootstrap') {
      return Promise.resolve({ student: { id: 'x', name: 'Tunde' } });
    }
    return Promise.resolve({});
  });
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'new@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalled());
  fireEvent.change(await screen.findByPlaceholderText(/000000/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  await screen.findByPlaceholderText(/your name/i);
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Tunde' } });
  fireEvent.change(screen.getByPlaceholderText(/phone/i), { target: { value: '08012345678' } });
  // Use specific label/aria-label or order to grab the right pin fields:
  const pinInputs = screen.getAllByPlaceholderText(/pin/i);
  fireEvent.change(pinInputs[0], { target: { value: '987654' } });
  fireEvent.change(pinInputs[1], { target: { value: '987654' } });
  fireEvent.click(screen.getByRole('button', { name: /start predicting/i }));

  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/bootstrap', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"phoneNumber":"08012345678"'),
    }));
  });
  await waitFor(() => expect(reload).toHaveBeenCalled());
});

test('mismatched PIN and confirm-PIN shows error', async () => {
  apiFetch.mockImplementation((path) => {
    if (path === '/api/multi-markets/me/info') {
      return Promise.reject(new ApiError('bootstrap', { code: 'BOOTSTRAP_REQUIRED', status: 401 }));
    }
    return Promise.resolve({});
  });

  render(<AuthModal onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'new@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalled());
  fireEvent.change(await screen.findByPlaceholderText(/000000/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  await screen.findByPlaceholderText(/your name/i);
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'X' } });
  fireEvent.change(screen.getByPlaceholderText(/phone/i), { target: { value: '08012345678' } });
  const pinInputs = screen.getAllByPlaceholderText(/pin/i);
  fireEvent.change(pinInputs[0], { target: { value: '111111' } });
  fireEvent.change(pinInputs[1], { target: { value: '222222' } });
  fireEvent.click(screen.getByRole('button', { name: /start predicting/i }));

  expect(await screen.findByText(/PINs do not match/i)).toBeInTheDocument();
});

test('pin step verifies PIN and reloads on 200', async () => {
  apiFetch.mockImplementation((path) => {
    if (path === '/api/auth/verify-pin') return Promise.resolve({ ok: true });
    return Promise.resolve({});
  });
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal initialStep="pin" onClose={() => {}} />);
  const pinInput = await screen.findByPlaceholderText(/000000/);
  fireEvent.change(pinInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /unlock/i }));

  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/verify-pin', expect.objectContaining({
      method: 'POST',
      body: '{"pin":"123456"}',
    }));
    expect(reload).toHaveBeenCalled();
  });
  expect(sessionStorage.getItem('pinUnlocked')).toBe('1');
});

test('pin step shows attempts_remaining on PIN_INVALID', async () => {
  apiFetch.mockRejectedValue(new ApiError('invalid', { code: 'PIN_INVALID', status: 401 }));
  // The above mock isn't enough because apiFetch throws but the test inspects the response body.
  // For the simulation, instead override apiFetch to throw an ApiError with attempts_remaining accessible.
  // Replace the implementation:
  apiFetch.mockImplementation(() => {
    const err = new ApiError('wrong pin', { code: 'PIN_INVALID', status: 401 });
    err.attemptsRemaining = 2;
    throw err;
  });

  render(<AuthModal initialStep="pin" onClose={() => {}} />);
  fireEvent.change(await screen.findByPlaceholderText(/000000/), { target: { value: '999999' } });
  fireEvent.click(screen.getByRole('button', { name: /unlock/i }));

  expect(await screen.findByText(/2 attempts left/i)).toBeInTheDocument();
});

test('PIN_LOCKED signs out and reloads', async () => {
  apiFetch.mockImplementation(() => {
    const err = new ApiError('locked', { code: 'PIN_LOCKED', status: 401 });
    throw err;
  });
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal initialStep="pin" onClose={() => {}} />);
  fireEvent.change(await screen.findByPlaceholderText(/000000/), { target: { value: '999999' } });
  fireEvent.click(screen.getByRole('button', { name: /unlock/i }));

  await waitFor(() => {
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});

test('Forgot PIN signs out, sets forgotPin flag, reloads', async () => {
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal initialStep="pin" onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /forgot pin/i }));

  await waitFor(() => {
    expect(sessionStorage.getItem('forgotPin')).toBe('1');
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});

test('set-pin step calls /api/auth/set-pin and reloads on success', async () => {
  apiFetch.mockResolvedValue({ ok: true });
  const reload = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload }, writable: true });

  render(<AuthModal initialStep="set-pin" onClose={() => {}} />);
  const pinInputs = await screen.findAllByPlaceholderText(/pin/i);
  fireEvent.change(pinInputs[0], { target: { value: '111111' } });
  fireEvent.change(pinInputs[1], { target: { value: '111111' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/set-pin', expect.objectContaining({
      method: 'POST',
      body: '{"pin":"111111"}',
    }));
    expect(reload).toHaveBeenCalled();
  });
  expect(sessionStorage.getItem('pinUnlocked')).toBe('1');
});
