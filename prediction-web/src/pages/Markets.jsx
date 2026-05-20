import { useState } from 'react';
import useStore from '../store.js';
import MarketCard from '../components/MarketCard.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import PublicChat from '../components/PublicChat.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';

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
      <div style={{
        display: 'flex', gap: '2px', padding: '0 16px',
        overflowX: 'auto', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
      }}>
        {categories.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                padding: '11px 16px', fontSize: '13px', fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                textTransform: 'capitalize',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div
        className="app-layout"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 300px',
          gap: '16px', padding: '16px 24px',
        }}
      >
        <main>
          {activeMarkets.length === 0 && resolvedMarkets.length === 0 ? (
            <div style={{
              padding: '40px', textAlign: 'center',
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
            <>
              <div className="markets-grid" style={{ columns: '2', columnGap: '10px' }}>
                {activeMarkets.map((market) => (
                  <div key={market.id} style={{ breakInside: 'avoid', marginBottom: '10px' }}>
                    <MarketCard market={market} />
                  </div>
                ))}
              </div>

              {resolvedMarkets.length > 0 && (
                <div className="markets-grid" style={{ columns: '2', columnGap: '10px', marginTop: '10px' }}>
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
          position: 'sticky', top: '70px', alignSelf: 'start',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
        </aside>
      </div>

      <div className="mobile-only" style={{ padding: '0 16px 80px' }}>
        <HowItWorks />
        <div style={{ marginTop: '10px' }}><PublicChat /></div>
        <div style={{ marginTop: '10px' }}><ActivityFeed /></div>
      </div>
    </>
  );
}
