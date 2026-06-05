import { useState, useEffect } from 'react';
import { CheckCircle2, Wallet } from 'lucide-react';
import { apiFetch } from '../api.js';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function RecentPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/rewards/recent-payouts')
      .then(setPayouts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
      marginTop: '24px',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--accent-green)',
          boxShadow: '0 0 6px var(--accent-green)',
        }} />
        <Wallet size={13} color="var(--text-secondary)" />
        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
          Recent Cashouts
        </h3>
      </div>

      <div style={{ padding: '8px' }}>
        {payouts.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Be the first to cash out! Earn 500+ points to redeem.
            </p>
          </div>
        ) : (
          payouts.map((payout, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: 'var(--radius)',
              }}
            >
              <CheckCircle2 size={14} color="var(--accent-green)" />
              <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payout.name}</span>
                {' cashed out '}
                <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{payout.reward_name}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {timeAgo(payout.fulfilled_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
