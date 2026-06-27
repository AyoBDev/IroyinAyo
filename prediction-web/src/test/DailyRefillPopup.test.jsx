import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const claimRefillMock = vi.fn();
const stateRef = { current: { pendingRefill: null } };

vi.mock('../store.js', () => {
  const useStore = (selector) => selector(stateRef.current);
  useStore.getState = () => stateRef.current;
  useStore.setState = (patch) => { stateRef.current = { ...stateRef.current, ...patch }; };
  return { default: useStore };
});

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(msg, { code, status } = {}) { super(msg); this.code = code; this.status = status; }
  },
}));

import DailyRefillPopup from '../components/DailyRefillPopup.jsx';

beforeEach(() => {
  sessionStorage.clear();
  stateRef.current = { pendingRefill: null, claimRefill: claimRefillMock };
  claimRefillMock.mockReset();
});

test('renders nothing when pendingRefill is null', () => {
  const { container } = render(<DailyRefillPopup />);
  expect(container.firstChild).toBeNull();
});

test('renders amount and Claim button when pendingRefill exists', () => {
  stateRef.current = { pendingRefill: { id: 'p1', amount: 75 }, claimRefill: claimRefillMock };
  render(<DailyRefillPopup />);
  expect(screen.getByText(/^\+75$/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /claim 75 points/i })).toBeInTheDocument();
});

test('clicking Claim calls claimRefill with the id and sets sessionStorage flag', async () => {
  stateRef.current = { pendingRefill: { id: 'p1', amount: 75 }, claimRefill: claimRefillMock };
  claimRefillMock.mockResolvedValue();
  render(<DailyRefillPopup />);
  fireEvent.click(screen.getByRole('button', { name: /claim 75 points/i }));
  await waitFor(() => {
    expect(claimRefillMock).toHaveBeenCalledWith('p1');
    expect(sessionStorage.getItem('refillSeen_p1')).toBe('1');
  });
});

test('does not render when sessionStorage flag is set for this id', () => {
  sessionStorage.setItem('refillSeen_p1', '1');
  stateRef.current = { pendingRefill: { id: 'p1', amount: 75 }, claimRefill: claimRefillMock };
  const { container } = render(<DailyRefillPopup />);
  expect(container.firstChild).toBeNull();
});

test('shows error message on claim failure (other than ALREADY_CLAIMED)', async () => {
  stateRef.current = { pendingRefill: { id: 'p1', amount: 75 }, claimRefill: claimRefillMock };
  claimRefillMock.mockRejectedValue(new Error('Network down'));
  render(<DailyRefillPopup />);
  fireEvent.click(screen.getByRole('button', { name: /claim 75 points/i }));
  expect(await screen.findByText(/network down|try again/i)).toBeInTheDocument();
});
