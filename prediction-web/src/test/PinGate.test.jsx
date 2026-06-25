import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
    },
  },
}));

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(msg, { code, status } = {}) { super(msg); this.code = code; this.status = status; }
  },
}));

vi.mock('../store.js', () => {
  const state = { user: null, needsBootstrap: false };
  const useStore = (selector) => selector ? selector(state) : state;
  useStore.setState = (patch) => Object.assign(state, patch);
  useStore.getState = () => state;
  return { default: useStore };
});

import PinGate from '../components/PinGate.jsx';
import useStore from '../store.js';

beforeEach(() => {
  sessionStorage.clear();
  useStore.setState({ user: null, needsBootstrap: false });
});

test('renders children when user is null', () => {
  useStore.setState({ user: null });
  render(<PinGate><div>child</div></PinGate>);
  expect(screen.getByText('child')).toBeInTheDocument();
});

test('renders children when user has_pin: true and pinUnlocked is set', () => {
  useStore.setState({ user: { id: 'x', has_pin: true } });
  sessionStorage.setItem('pinUnlocked', '1');
  render(<PinGate><div>child</div></PinGate>);
  expect(screen.getByText('child')).toBeInTheDocument();
});

test('renders pin modal when user has_pin: true and no pinUnlocked', () => {
  useStore.setState({ user: { id: 'x', has_pin: true } });
  render(<PinGate><div>child</div></PinGate>);
  expect(screen.queryByText('child')).not.toBeInTheDocument();
  expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
});

test('renders set-pin modal when user has_pin: false', () => {
  useStore.setState({ user: { id: 'x', has_pin: false } });
  render(<PinGate><div>child</div></PinGate>);
  expect(screen.queryByText('child')).not.toBeInTheDocument();
  expect(screen.getByText(/create your pin/i)).toBeInTheDocument();
});
