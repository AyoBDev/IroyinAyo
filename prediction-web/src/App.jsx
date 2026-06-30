import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutGroup } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import { supabase } from './lib/supabase.js';
import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import MyPositions from './components/MyPositions.jsx';
import AuthModal from './components/NoAuth.jsx';
import PinGate from './components/PinGate.jsx';
import Markets from './pages/Markets.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import Profile from './pages/Profile.jsx';
import ResolutionToast from './components/ResolutionToast.jsx';
import WinPopup from './components/WinPopup.jsx';
import DailyRefillPopup from './components/DailyRefillPopup.jsx';
import MarketDetail from './pages/MarketDetail.jsx';
import ShareCard from './pages/ShareCard.jsx';
import SharePrediction from './pages/SharePrediction.jsx';
import Crews from './pages/Crews.jsx';
import CrewDetail from './pages/CrewDetail.jsx';

function MainApp() {
  const [showPositions, setShowPositions] = useState(false);
  const { loading, showAuthModal, closeAuthModal, fetchMarkets, fetchUser, fetchPositions, fetchLeaderboard, fetchPendingRefill, updateOdds, addFeedItem, updateBalance, resolveMarket } = useStore();

  useEffect(() => {
    fetchMarkets();
    fetchUser();
    fetchPendingRefill();
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
      // The AuthModal sets this flag right before its own intentional signOut
      // (PIN_LOCKED bounce, Forgot PIN reset). In those cases we transition
      // inline and don't want the listener to reload out from under us.
      if (sessionStorage.getItem('inlineSignOut') === '1') {
        sessionStorage.removeItem('inlineSignOut');
        return;
      }
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
    <PinGate>
      <div className="pt-14">
        <ResolutionToast />
        <TopBar />
        {showPositions && <MyPositions onClose={() => setShowPositions(false)} />}

        <LayoutGroup>
          <Routes>
            <Route path="/" element={<Markets />} />
            <Route path="/market/:marketId" element={<MarketDetail />} />
            <Route path="/crews" element={<Crews />} />
            <Route path="/crews/:id" element={<CrewDetail />} />
            <Route path="/crews/:id/pools/:poolId" element={<div className="p-4 text-ink-muted">Crew pool (placeholder)</div>} />
            <Route path="/invite/:token" element={<div className="p-4 text-ink-muted">Join crew (placeholder)</div>} />
            <Route path="/portfolio" element={<Navigate to="/profile" replace />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LayoutGroup>

        <BottomNav />
        {showAuthModal && <AuthModal onClose={closeAuthModal} />}
        <DailyRefillPopup />
        <WinPopup />
      </div>
    </PinGate>
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
