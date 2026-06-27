import { create } from 'zustand';
import { apiFetch, ApiError } from './api.js';
import { supabase } from './lib/supabase.js';

const useStore = create((set, get) => ({
  markets: [],
  user: null,
  positions: [],
  leaderboard: [],
  feed: [],
  toast: null,
  loading: true,
  error: null,
  showAuthModal: false,
  needsBootstrap: false,
  pendingRefill: null,
  refillsRemaining: 3,
  openAuthModal: () => set({ showAuthModal: true }),
  closeAuthModal: () => set({ showAuthModal: false }),
  tutorialRunRequested: false,
  requestTutorialReplay: () => set({ tutorialRunRequested: true }),
  clearTutorialReplay: () => set({ tutorialRunRequested: false }),

  fetchMarkets: async () => {
    try {
      const markets = await apiFetch('/api/multi-markets');
      set({ markets, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchUser: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ user: null, needsBootstrap: false });
      return;
    }
    try {
      const user = await apiFetch('/api/multi-markets/me/info');
      set({ user, needsBootstrap: false });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BOOTSTRAP_REQUIRED') {
        set({ user: null, needsBootstrap: true, showAuthModal: true });
        return;
      }
      set({ user: null, needsBootstrap: false });
    }
  },

  fetchPositions: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ positions: [] });
      return;
    }
    try {
      const positions = await apiFetch('/api/multi-markets/me/positions');
      set({ positions });
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  },

  fetchLeaderboard: async () => {
    try {
      const data = await apiFetch('/api/multi-markets/leaderboard');
      set({ leaderboard: data?.standings ?? data ?? [] });
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  },

  placePrediction: async (marketId, outcomeId, amount, sourceRef = null) => {
    const result = await apiFetch(`/api/multi-markets/${marketId}/predict`, {
      method: 'POST',
      body: JSON.stringify({ outcomeId, amount, sourceRef }),
    });
    const user = get().user;
    if (user) set({ user: { ...user, points_balance: user.points_balance - amount } });
    return result;
  },

  updateOdds: (marketId, outcomes) => {
    set((state) => ({
      markets: state.markets.map((m) =>
        m.id === marketId
          ? { ...m, outcomes: m.outcomes.map((o) => {
              const updated = outcomes.find((u) => u.id === o.id);
              return updated ? { ...o, prevPrice: o.price, price: updated.price } : o;
            })}
          : m
      ),
    }));
  },

  addFeedItem: (item) => {
    set((state) => ({
      feed: [{ ...item, timestamp: Date.now() }, ...state.feed].slice(0, 20),
    }));
  },

  updateBalance: (balance) => {
    set((state) => ({
      user: state.user ? { ...state.user, points_balance: balance } : null,
    }));
  },

  resolveMarket: (marketId, winnerLabel, winnerId) => {
    const market = get().markets.find((m) => m.id === marketId);
    set((state) => ({
      markets: state.markets.map((m) =>
        m.id === marketId ? { ...m, status: 'resolved', winnerLabel, winnerId } : m
      ),
      toast: { type: 'resolution', title: market?.title, winner: winnerLabel },
    }));
    setTimeout(() => set({ toast: null }), 5000);
  },

  fetchPendingRefill: async () => {
    try {
      const data = await apiFetch('/api/me/pending-refill');
      set({ pendingRefill: data.pending, refillsRemaining: data.refillsRemaining });
    } catch (err) {
      // Silently ignore — refill UI is optional. Don't break the app on failure.
    }
  },

  claimRefill: async (id) => {
    try {
      const data = await apiFetch('/api/me/pending-refill/claim', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      const user = get().user;
      set({
        pendingRefill: null,
        user: user ? { ...user, points_balance: user.points_balance + data.amount } : user,
      });
    } catch (err) {
      if (err.code === 'ALREADY_CLAIMED') {
        set({ pendingRefill: null });
        return;
      }
      throw err;
    }
  },

  dismissToast: () => set({ toast: null }),
}));

export default useStore;
