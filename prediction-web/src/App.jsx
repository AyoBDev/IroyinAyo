import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getToken, setToken } from './api.js';
import { connectSocket } from './socket.js';
import useStore from './store.js';
import TopBar from './components/TopBar.jsx';
import MarketCard from './components/MarketCard.jsx';
import ActivityFeed from './components/ActivityFeed.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import MyPositions from './components/MyPositions.jsx';
import PublicChat from './components/PublicChat.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import NoAuth from './components/NoAuth.jsx';

export default function App() {
  const [showPositions, setShowPositions] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
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

  const isHackathon = (m) => m.title.includes('place');
  const isFootball = (m) => !isHackathon(m);

  const sortedMarkets = [...markets].sort((a, b) => {
    if (isHackathon(a) && !isHackathon(b)) return -1;
    if (!isHackathon(a) && isHackathon(b)) return 1;
    return 0;
  });

  const filteredMarkets = sortedMarkets.filter((m) => {
    if (activeTab === 'all') return true;
    if (activeTab === '1st') return m.title.includes('1st');
    if (activeTab === '2nd') return m.title.includes('2nd');
    if (activeTab === '3rd') return m.title.includes('3rd');
    if (activeTab === 'football') return isFootball(m);
    return true;
  });

  const resolvedMarkets = filteredMarkets.filter((m) => m.status === 'resolved');

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TopBar
        onPositionsClick={() => setShowPositions(!showPositions)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {showPositions && <MyPositions onClose={() => setShowPositions(false)} />}

      <div
        className="app-layout"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 300px',
          gap: '16px', padding: '16px 24px',
        }}
      >
        <main>
          {filteredMarkets.length === 0 ? (
            <div style={{
              padding: '40px', textAlign: 'center',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ color: 'var(--text-tertiary)' }}>No markets found</p>
            </div>
          ) : (
            <>
              {/* All markets in masonry layout */}
              <div className="markets-grid" style={{
                columns: '2', columnGap: '10px',
              }}>
                {filteredMarkets.filter((m) => m.status !== 'resolved').map((market) => (
                  <div key={market.id} style={{ breakInside: 'avoid', marginBottom: '10px' }}>
                    <MarketCard market={market} />
                  </div>
                ))}
              </div>

              {/* Resolved markets */}
              {resolvedMarkets.length > 0 && (
                <div className="markets-grid" style={{
                  columns: '2', columnGap: '10px', marginTop: '10px',
                }}>
                  {resolvedMarkets.map((market) => (
                    <div key={market.id} style={{ breakInside: 'avoid', marginBottom: '10px' }}>
                      <MarketCard market={market} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <aside className="desktop-sidebar" style={{
          position: 'sticky', top: '110px', alignSelf: 'start',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
          <Leaderboard />
        </aside>
      </div>

      <div className="mobile-only" style={{ padding: '0 16px 16px' }}>
        <HowItWorks />
        <div style={{ marginTop: '10px' }}>
          <PublicChat />
        </div>
        <div style={{ marginTop: '10px' }}>
          <ActivityFeed />
        </div>
        <div style={{ marginTop: '10px' }}>
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
