import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import { supabase } from './lib/supabase.js';
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
import InstallBanner from './components/InstallBanner.jsx';

function MainApp() {
  const [showPositions, setShowPositions] = useState(false);
  const { loading, showAuthModal, closeAuthModal, fetchMarkets, fetchUser, fetchPositions, fetchLeaderboard, updateOdds, addFeedItem, updateBalance, resolveMarket } = useStore();

  useEffect(() => {
    fetchMarkets();
    fetchUser();
    fetchPositions();
    fetchLeaderboard();

    let socket;
    let cancelled = false;

    (async () => {
      socket = await connectSocket();
      if (cancelled) return;

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
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('odds:update');
        socket.off('prediction:placed');
        socket.off('balance:update');
        socket.off('market:resolved');
      }
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.reload();
      }
      if (event === 'SIGNED_IN' && !session) {
        window.location.reload();
      }
    });
    return () => subscription.unsubscribe();
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
      <InstallBanner />
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
      <Routes>
        <Route path="/share/:marketId" element={<ShareCard />} />
        <Route path="/share/prediction/:positionId" element={<SharePrediction />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
