import { useEffect, useState } from 'react';
import { getToken, setToken } from './api.js';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import TopBar from './components/TopBar.jsx';
import MarketCard from './components/MarketCard.jsx';
import ActivityFeed from './components/ActivityFeed.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import MyPositions from './components/MyPositions.jsx';
import NoAuth from './components/NoAuth.jsx';

export default function App() {
  const [showPositions, setShowPositions] = useState(false);
  const { markets, user, loading, fetchMarkets, fetchUser, fetchPositions, fetchLeaderboard, updateOdds, addFeedItem, updateBalance, resolveMarket } = useStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('t');
    if (tokenParam) {
      setToken(tokenParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const token = getToken();

  useEffect(() => {
    if (!token) return;

    fetchMarkets();
    fetchUser();
    fetchPositions();
    fetchLeaderboard();

    const socket = connectSocket();

    socket.on('odds:update', ({ marketId, outcomes }) => {
      updateOdds(marketId, outcomes);
    });

    socket.on('bet:placed', ({ marketId, outcomeLabel, amount }) => {
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
      socket.off('bet:placed');
      socket.off('balance:update');
      socket.off('market:resolved');
    };
  }, [token]);

  if (!token) return <NoAuth />;
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><p>Loading...</p></div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <TopBar onPositionsClick={() => setShowPositions(!showPositions)} />

      {showPositions && <MyPositions onClose={() => setShowPositions(false)} />}

      <div className="app-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem', padding: '1.5rem' }}>
        <main>
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
          <Leaderboard />
          <div className="mobile-feed" style={{ display: 'none', marginTop: '1rem' }}>
            <ActivityFeed />
          </div>
        </main>
        <aside className="desktop-sidebar" style={{ position: 'sticky', top: '80px', alignSelf: 'start' }}>
          <ActivityFeed />
        </aside>
      </div>
    </div>
  );
}
