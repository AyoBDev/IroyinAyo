import { useState, useEffect } from 'react';
import { Eye, TrendingUp } from 'lucide-react';
import { apiFetch } from '../api.js';

export default function SharpMoney() {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    apiFetch('/api/multi-markets/sharp-money')
      .then(setPicks)
      .catch(() => {});
  }, []);

  if (picks.length === 0) return null;

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden">
      <div className="py-3.5 px-4 border-b border-line flex items-center gap-2">
        <Eye size={13} className="text-accent-yellow" />
        <h3 className="font-serif text-xs uppercase tracking-wide text-ink-muted">
          Sharp Money
        </h3>
      </div>

      <div className="max-h-[300px] overflow-auto p-1.5">
        {picks.map((pick) => (
          <div key={pick.id} className="py-2.5 px-3 rounded-md my-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-[18px] h-[18px] rounded-full bg-accent-yellow-bg border border-accent-yellow-border flex items-center justify-center text-[9px] font-bold text-accent-yellow">
                {pick.student_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-[11px] font-semibold text-ink">
                {pick.student_name}
              </span>
              <span className="text-[10px] text-accent-yellow font-semibold ml-auto font-mono">
                {pick.amount} pts
              </span>
            </div>
            <div className="text-[11px] text-ink-muted ml-6">
              <TrendingUp size={10} className="inline align-middle mr-1" />
              <span className="text-accent-green font-semibold">{pick.outcome_label}</span>
              <span className="text-ink-muted"> in </span>
              <span className="text-ink-muted">{pick.market_title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
