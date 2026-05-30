import { useState } from 'react';
import useStore from '../store.js';
import MarketCard from '../components/MarketCard.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import PublicChat from '../components/PublicChat.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import SharpMoney from '../components/SharpMoney.jsx';

export default function Markets() {
  const [activeTab, setActiveTab] = useState('all');
  const { markets } = useStore();

  const categories = ['all', ...new Set(markets.map((m) => m.category).filter(Boolean))];

  const filteredMarkets = activeTab === 'all'
    ? markets
    : markets.filter((m) => m.category === activeTab);

  const activeMarkets = filteredMarkets.filter((m) => m.status !== 'resolved');
  const resolvedMarkets = filteredMarkets.filter((m) => m.status === 'resolved');

  return (
    <>
      {/* Category Chips */}
      <section className="no-scrollbar" style={{
        display: 'flex', gap: '8px', padding: '16px 16px',
        overflowX: 'auto',
      }}>
        {categories.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'var(--primary)' : 'var(--bg-surface-container)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
                textTransform: 'capitalize',
              }}
            >
              {cat === 'all' ? 'Trending' : cat}
            </button>
          );
        })}
      </section>

      {/* Market Feed */}
      <div
        className="app-layout"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 300px',
          gap: '16px', padding: '0 16px 16px',
          maxWidth: '1400px', margin: '0 auto',
        }}
      >
        <main>
          {activeMarkets.length === 0 && resolvedMarkets.length === 0 ? (
            <div style={{
              padding: '48px 20px', textAlign: 'center',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                No markets in this category yet
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                New markets are added weekly. Check back soon!
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}>
              {activeMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
              {resolvedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </main>

        <aside className="desktop-sidebar" style={{
          position: 'sticky', top: '76px', alignSelf: 'start',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <SharpMoney />
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
          <Leaderboard />
        </aside>
      </div>

      <div className="mobile-only" style={{ padding: '0 16px 80px' }}>
        <SharpMoney />
        <div style={{ marginTop: '12px' }}><HowItWorks /></div>
        <div style={{ marginTop: '12px' }}><PublicChat /></div>
        <div style={{ marginTop: '12px' }}><ActivityFeed /></div>
        <div style={{ marginTop: '12px' }}><Leaderboard /></div>
      </div>
    </>
  );
}
