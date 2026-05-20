import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getToken, setToken } from './api.js';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import MyPositions from './components/MyPositions.jsx';
import NoAuth from './components/NoAuth.jsx';
import Markets from './pages/Markets.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import Profile from './pages/Profile.jsx';
import ResolutionToast from './components/ResolutionToast.jsx';

function TokenExchange() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const tokenParam = searchParams.get('t');
    if (tokenParam) {
      window.history.replaceState({}, '', window.location.pathname);
      fetch('/api/auth/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlToken: tokenParam }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.token) {
            setToken(data.token);
            window.location.reload();
          }
        })
        .catch(() => {});
    }
  }, []);

  return null;
}

function AuthenticatedApp() {
  const [showPositions, setShowPositions] = useState(false);
  const { loading, fetchMarkets, fetchUser, fetchPositions, fetchLeaderboard, updateOdds, addFeedItem, updateBalance, resolveMarket } = useStore();

  useEffect(() => {
    fetchMarkets();
    fetchUser();
    fetchPositions();
    fetchLeaderboard();

    const socket = connectSocket();

    socket.on('odds:update', ({ marketId, outcomes }) => {
      updateOdds(marketId, outcomes);
    });

    socket.on('prediction:placed', ({ marketId, outcomeLabel, amount }) => {
      addFeedItem({ marketId, outcomeLabel, amount });
    });

    socket.on('balance:update', ({ balance }) => {
      updateBalance(balance);
    });

    socket.on('market:resolved', ({ marketId, winnerLabel, winnerId }) => {
      resolveMarket(marketId, winnerLabel, winnerId);
    });

    return () => {
      socket.off('odds:update');
      socket.off('prediction:placed');
      socket.off('balance:update');
      socket.off('market:resolved');
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <ResolutionToast />
      <TopBar onPositionsClick={() => setShowPositions(!showPositions)} />
      {showPositions && <MyPositions onClose={() => setShowPositions(false)} />}

      <Routes>
        <Route path="/" element={<Markets />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />
    </div>
  );
}

export default function App() {
  const token = getToken();

  return (
    <BrowserRouter>
      <TokenExchange />
      {token ? <AuthenticatedApp /> : <NoAuth />}
    </BrowserRouter>
  );
}
