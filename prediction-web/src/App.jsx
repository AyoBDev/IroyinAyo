import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getToken, setToken } from './api.js';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import MyPositions from './components/MyPositions.jsx';
import AuthModal from './components/NoAuth.jsx';
import Markets from './pages/Markets.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import Profile from './pages/Profile.jsx';
import ResolutionToast from './components/ResolutionToast.jsx';
import WinPopup from './components/WinPopup.jsx';
import MarketDetail from './pages/MarketDetail.jsx';
import ShareCard from './pages/ShareCard.jsx';
import SharePrediction from './pages/SharePrediction.jsx';
import Portfolio from './pages/Portfolio.jsx';

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

function MainApp() {
  const [showPositions, setShowPositions] = useState(false);
  const { loading, showAuthModal, closeAuthModal, fetchMarkets, fetchUser, fetchPositions, fetchLeaderboard, updateOdds, addFeedItem, updateBalance, resolveMarket } = useStore();

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
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 size={32} className="text-emerald animate-spin mx-auto mb-3" />
          <p className="text-ink-muted text-body-sm">Loading markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14">
      <ResolutionToast />
      <TopBar />
      {showPositions && <MyPositions onClose={() => setShowPositions(false)} />}

      <Routes>
        <Route path="/" element={<Markets />} />
        <Route path="/market/:marketId" element={<MarketDetail />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />
      {showAuthModal && <AuthModal onClose={closeAuthModal} />}
      <WinPopup />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenExchange />
      <Routes>
        <Route path="/share/:marketId" element={<ShareCard />} />
        <Route path="/share/prediction/:positionId" element={<SharePrediction />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
