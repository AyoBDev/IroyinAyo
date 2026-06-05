import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChartLine, Loader2 } from 'lucide-react';
import { apiFetch, getToken } from '../api.js';
import { connectSocket } from '../socket.js';

export default function Portfolio() {
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      navigate('/');
      return;
    }

    apiFetch('/api/multi-markets/me/portfolio')
      .then(setPortfolio)
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = connectSocket();
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
    return () => { socket.off('odds:update', handleOddsUpdate); };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader2 size={24} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!portfolio || (portfolio.open.length === 0 && portfolio.resolved.length === 0)) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <ChartLine size={32} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>
          No predictions yet.
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Find a market you believe in!
        </p>
      </div>
    );
  }

  const totalUnrealized = portfolio.open.reduce((sum, p) => sum + p.unrealized_pnl, 0);

  return (
    <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Portfolio</h2>
        {portfolio.open.length > 0 && (
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: totalUnrealized >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toFixed(1)} pts
          </span>
        )}
      </div>

      {portfolio.open.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse 2s infinite', boxShadow: '0 0 6px var(--accent-green)' }} />
            Open Positions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {portfolio.open.map(pos => (
              <div
                key={pos.id}
                onClick={() => navigate(`/market/${pos.market_id}`)}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border)', padding: '16px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, marginRight: '12px' }}>
                    {pos.market_title}
                  </p>
                  <span style={{
                    fontSize: '13px', fontWeight: 700,
                    color: pos.unrealized_pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl.toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{pos.outcome_label}</span>
                  {pos.entry_price != null && (
                    <span>{Math.round(pos.entry_price * 100)}% → {Math.round(pos.current_price * 100)}%</span>
                  )}
                  <span>{pos.shares.toFixed(1)} shares</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {portfolio.resolved.length > 0 && (
        <div>
          <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
            Resolved
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {portfolio.resolved.map(pos => (
              <div
                key={pos.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border)', padding: '16px',
                  opacity: 0.8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', flex: 1, marginRight: '12px' }}>
                    {pos.market_title}
                  </p>
                  <span style={{
                    fontSize: '13px', fontWeight: 700,
                    color: pos.won ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {pos.won ? `+${pos.payout}` : `-${pos.amount}`} pts
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{pos.outcome_label}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                    borderRadius: 'var(--radius)',
                    background: pos.won ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)',
                    color: pos.won ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
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
