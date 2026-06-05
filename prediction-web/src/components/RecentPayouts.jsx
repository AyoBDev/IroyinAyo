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
    <div className="bg-paper rounded-2xl border border-line overflow-hidden mt-6">
      <div className="py-3.5 px-4 border-b border-line flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        <Wallet size={13} className="text-ink-muted" />
        <h3 className="font-serif text-xs uppercase tracking-wide text-ink-muted">
          Recent Cashouts
        </h3>
      </div>

      <div className="p-2">
        {payouts.length === 0 ? (
          <div className="py-6 px-4 text-center">
            <p className="text-ink-muted text-xs">
              Be the first to cash out! Earn 500+ points to redeem.
            </p>
          </div>
        ) : (
          payouts.map((payout, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 py-2.5 px-3 rounded-md"
            >
              <CheckCircle2 size={14} className="text-accent-green" />
              <div className="flex-1 text-xs text-ink-muted">
                <span className="font-semibold text-ink">{payout.name}</span>
                {' cashed out '}
                <span className="font-semibold text-accent-green">{payout.reward_name}</span>
              </div>
              <span className="text-[11px] text-ink-muted whitespace-nowrap font-mono">
                {timeAgo(payout.fulfilled_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
