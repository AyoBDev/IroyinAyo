import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import MarketCard from '../components/MarketCard.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import PublicChat from '../components/PublicChat.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import SharpMoney from '../components/SharpMoney.jsx';
import CreateMarketFAB from '../components/CreateMarketFAB.jsx';
import CreateMarketForm from '../components/CreateMarketForm.jsx';
import Tutorial from '../components/Tutorial.jsx';
import { useDeepLinkRef } from '../hooks/useDeepLinkRef.js';
import MarketsTopStrip from '../components/MarketsTopStrip.jsx';


function LivePredictorCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    apiFetch('/api/multi-markets/social-proof')
      .then(data => setCount(data.activePredictors))
      .catch(() => {});
  }, []);

  if (!count || count < 3) return null;

  return (
    <div data-tutorial="incentives" className="flex items-center gap-2 px-3 py-2 mx-4 mt-3 mb-2 rounded-lg bg-accent-green-bg border border-accent-green-border">
      <div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_6px_var(--accent-green)]" />
      <span className="text-xs text-ink-muted">
        <strong className="text-accent-green">{count}</strong> predictors active this week
      </span>
    </div>
  );
}

export default function Markets() {
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { markets, user } = useStore();
  const { ref, lede } = useDeepLinkRef();
  const showRankStrip = ref === 'wa_daily' && lede === 'rank';
  const [stripMarkets, setStripMarkets] = useState([]);

  useEffect(() => {
    if (!showRankStrip) return;
    if (!user) return;
    let cancelled = false;
    apiFetch('/api/habit/rank-strip-markets')
      .then((data) => { if (!cancelled) setStripMarkets(data?.markets || []); })
      .catch(() => { if (!cancelled) setStripMarkets([]); });
    return () => { cancelled = true; };
  }, [showRankStrip, user]);

  const categories = ['all', ...new Set(markets.map((m) => m.category).filter(Boolean))];

  const filteredMarkets = activeTab === 'all'
    ? markets
    : markets.filter((m) => m.category === activeTab);

  const activeMarkets = filteredMarkets.filter((m) => m.status !== 'resolved');
  const resolvedMarkets = filteredMarkets.filter((m) => m.status === 'resolved');

  return (
    <>
      <Tutorial />
      <LivePredictorCount />
      {showRankStrip && <MarketsTopStrip markets={stripMarkets} />}

      {/* Category Chips */}
      <section className="no-scrollbar flex gap-2 px-4 py-4 overflow-x-auto">
        {categories.map((cat) => {
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-5 py-2 text-xs font-semibold whitespace-nowrap rounded-full capitalize transition-colors ${
                isActive
                  ? 'bg-emerald text-bone'
                  : 'bg-paper text-ink-muted border border-line hover:bg-paper-hover'
              }`}
            >
              {cat === 'all' ? 'Trending' : cat}
            </button>
          );
        })}
      </section>

      {/* Market Feed */}
      <div className="app-layout grid grid-cols-[1fr_300px] gap-4 px-4 pb-4 max-w-[1400px] mx-auto">
        <main>
          {activeMarkets.length === 0 && resolvedMarkets.length === 0 ? (
            <div className="px-5 py-12 text-center bg-paper rounded-2xl border border-line">
              <p className="text-body-sm text-ink-muted mb-2">
                No markets in this category yet
              </p>
              <p className="text-xs text-ink-muted opacity-70">
                New markets are added weekly. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {activeMarkets.map((market, index) => (
                <MarketCard key={market.id} market={market} dataTutorial={index === 0 ? 'market-card' : undefined} />
              ))}
              {resolvedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </main>

        <aside className="desktop-sidebar sticky top-[76px] self-start flex flex-col gap-3">
          <SharpMoney />
          <HowItWorks />
          <PublicChat />
          <ActivityFeed />
          <Leaderboard />
        </aside>
      </div>

      <div className="mobile-only px-4 pb-20">
        <SharpMoney />
        <div className="mt-3"><HowItWorks /></div>
        <div className="mt-3"><PublicChat /></div>
        <div className="mt-3"><ActivityFeed /></div>
        <div className="mt-3"><Leaderboard /></div>
      </div>

      <CreateMarketFAB onClick={() => setShowCreateForm(true)} />
      {showCreateForm && <CreateMarketForm onClose={() => setShowCreateForm(false)} />}
    </>
  );
}
