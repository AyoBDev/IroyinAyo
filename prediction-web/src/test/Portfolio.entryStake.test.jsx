import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
  },
}));

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock('../socket.js', () => ({
  connectSocket: vi.fn().mockResolvedValue({ on: vi.fn(), off: vi.fn() }),
}));

vi.mock('../store.js', () => {
  const state = { user: { id: 'u1', points_balance: 100 } };
  const useStore = (selector) => selector ? selector(state) : state;
  useStore.getState = () => state;
  return { default: useStore };
});

import Portfolio from '../pages/Portfolio.jsx';
import { apiFetch } from '../api.js';

beforeEach(() => {
  vi.clearAllMocks();
});

test('open-position row displays entry stake in pts', async () => {
  apiFetch.mockResolvedValue({
    open: [
      {
        id: 'pos-1',
        market_id: 'm1',
        market_title: 'Will it rain?',
        outcome_id: 'o1',
        outcome_label: 'YES',
        amount: 50,
        shares: 1.0,
        entry_price: 0.5,
        current_price: 0.6,
        unrealized_pnl: 10,
      },
    ],
    resolved: [],
  });

  render(<MemoryRouter><Portfolio /></MemoryRouter>);
  await waitFor(() => {
    expect(screen.getByText(/will it rain/i)).toBeInTheDocument();
  });
  expect(screen.getByText(/50 pts/i)).toBeInTheDocument();
});
