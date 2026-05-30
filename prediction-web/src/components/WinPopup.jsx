import { useState, useEffect } from 'react';
import { Trophy, X, Sparkles } from 'lucide-react';
import { apiFetch, getToken } from '../api.js';

export default function WinPopup() {
  const [wins, setWins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    apiFetch('/api/multi-markets/me/wins')
      .then((data) => {
        if (data && data.length > 0) {
          setWins(data);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    if (currentIndex < wins.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setVisible(false);
      apiFetch('/api/multi-markets/me/wins/acknowledge', { method: 'POST' }).catch(() => {});
    }
  }

  if (!visible || wins.length === 0) return null;

  const win = wins[currentIndex];
  const profit = win.payout - win.amount;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.3s ease',
    }} onClick={dismiss}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1a2338 0%, #0f1a12 50%, #1a2338 100%)',
          border: '1px solid var(--accent-green-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '340px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 0 60px rgba(16, 185, 129, 0.15), 0 8px 32px rgba(0,0,0,0.5)',
          animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <button onClick={dismiss} style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'var(--bg-secondary)', border: 'none',
          color: 'var(--text-tertiary)', width: '28px', height: '28px',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={14} />
        </button>

        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'var(--accent-green-bg)', border: '2px solid var(--accent-green-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Trophy size={28} color="var(--accent-yellow)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
          <Sparkles size={14} color="var(--accent-yellow)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            You Won!
          </span>
          <Sparkles size={14} color="var(--accent-yellow)" />
        </div>

        <div style={{
          fontSize: '32px', fontWeight: 800, color: 'var(--accent-green)',
          fontFamily: 'Satoshi, sans-serif', marginBottom: '4px',
        }}>
          +{win.payout} pts
        </div>

        {profit > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {win.amount} invested → {profit} profit
          </div>
        )}

        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          padding: '12px 16px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            {win.market_title}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {win.outcome_label}
          </div>
        </div>

        <button onClick={dismiss} style={{
          width: '100%', padding: '12px',
          background: 'var(--accent-green)', color: '#fff',
          borderRadius: 'var(--radius-lg)', fontSize: '14px', fontWeight: 700,
          border: 'none',
        }}>
          {currentIndex < wins.length - 1 ? 'Next Win →' : 'Nice!'}
        </button>

        {wins.length > 1 && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '10px' }}>
            {currentIndex + 1} of {wins.length} wins
          </div>
        )}
      </div>
    </div>
  );
}
