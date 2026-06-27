import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChartLine, Loader2 } from 'lucide-react';
import useStore from '../store.js';
import { apiFetch } from '../api.js';
import { connectSocket } from '../socket.js';

export default function Portfolio() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    apiFetch('/api/multi-markets/me/portfolio')
      .then(setPortfolio)
      .catch(() => {})
      .finally(() => setLoading(false));

    let socket;
    let cancelled = false;

    (async () => {
      socket = await connectSocket();
      if (cancelled) return;

      const handleOddsUpdate = ({ marketId, outcomes }) => {
        setPortfolio(prev => {
          if (!prev) return prev;
          const updatedOpen = prev.open.map(pos => {
            if (pos.market_id !== marketId) return pos;
            const updated = outcomes.find(o => o.id === pos.outcome_id);
            if (!updated) return pos;
            const newPnl = (updated.price * pos.shares) - pos.amount;
            return { ...pos, current_price: updated.price, unrealized_pnl: Math.round(newPnl * 100) / 100 };
          });
          return { ...prev, open: updatedOpen };
        });
      };

      socket.on('odds:update', handleOddsUpdate);
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('odds:update');
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-[60px]">
        <Loader2 size={24} className="text-emerald animate-spin" />
      </div>
    );
  }

  if (!portfolio || (portfolio.open.length === 0 && portfolio.resolved.length === 0)) {
    return (
      <div className="py-[60px] px-6 text-center">
        <ChartLine size={32} className="text-ink-muted mb-3 mx-auto" />
        <p className="text-ink-muted text-sm mb-1.5">
          No predictions yet.
        </p>
        <p className="text-ink-muted text-xs">
          Find a market you believe in!
        </p>
      </div>
    );
  }

  const totalUnrealized = portfolio.open.reduce((sum, p) => sum + p.unrealized_pnl, 0);

  return (
    <div className="p-4 max-w-[700px] mx-auto pb-[100px]">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-section font-semibold text-ink">Portfolio</h2>
        {portfolio.open.length > 0 && (
          <span className={`font-mono text-[13px] font-bold ${totalUnrealized >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toFixed(1)} pts
          </span>
        )}
      </div>

      {portfolio.open.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-2.5 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            Open Positions
          </h3>
          <div className="flex flex-col gap-2">
            {portfolio.open.map(pos => (
              <div
                key={pos.id}
                onClick={() => navigate(`/market/${pos.market_id}`)}
                className="bg-paper rounded-2xl border border-line p-4 cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[13px] font-semibold text-ink flex-1 mr-3">
                    {pos.market_title}
                  </p>
                  <span className={`font-mono text-[13px] font-bold ${pos.unrealized_pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span className="font-semibold text-emerald">{pos.outcome_label}</span>
                  {pos.entry_price != null && (
                    <span className="font-mono">{Math.round(pos.entry_price * 100)}% → {Math.round(pos.current_price * 100)}%</span>
                  )}
                  <span className="font-mono">{pos.amount} pts</span>
                  <span className="font-mono">{pos.shares.toFixed(1)} shares</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {portfolio.resolved.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-2.5">
            Resolved
          </h3>
          <div className="flex flex-col gap-2">
            {portfolio.resolved.map(pos => (
              <div
                key={pos.id}
                className="bg-paper rounded-2xl border border-line p-4 opacity-80"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <p className="text-[13px] font-semibold text-ink-muted flex-1 mr-3">
                    {pos.market_title}
                  </p>
                  <span className={`font-mono text-[13px] font-bold ${pos.won ? 'text-accent-green' : 'text-accent-red'}`}>
                    {pos.won ? `+${pos.payout}` : `-${pos.amount}`} pts
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-muted">{pos.outcome_label}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${pos.won ? 'bg-accent-green-bg text-accent-green' : 'bg-accent-red-bg text-accent-red'}`}>
                    {pos.won ? 'Won' : 'Lost'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
