import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

function pct(x) {
  return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`;
}

export default function ProfileAccuracyHeader({ userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch(`/api/habit/accuracy/${userId}`)
      .then(setData)
      .catch(() => setData(null));
  }, [userId]);

  if (!data || data.allTime.accuracy === null) return null;

  const allTime = pct(data.allTime.accuracy);
  const resolved = data.allTime.resolvedCalls;
  const last30 = data.last30Days.accuracy !== null ? pct(data.last30Days.accuracy) : null;
  const rank = data.rank?.rank ?? null;
  const totalRanked = data.rank?.totalRanked ?? null;
  const topPercent = rank && totalRanked
    ? Math.max(1, Math.ceil((rank / totalRanked) * 100))
    : null;

  return (
    <section className="bg-paper rounded-2xl border border-line p-5 mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">
            Accuracy
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[40px] leading-none font-bold text-ink">{allTime}</span>
            {last30 && (
              <span className="font-mono text-[11px] text-ink-muted">
                30D {last30}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-ink-muted">
            {resolved} resolved call{resolved === 1 ? '' : 's'}
            {topPercent && topPercent <= 50 ? ` · top ${topPercent}%` : ''}
          </p>
        </div>
      </div>

      {data.byCategory.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {data.byCategory.map((c) => (
            <div
              key={c.category}
              className="shrink-0 bg-bone border border-line rounded-full px-3 py-1 text-[11px] flex items-center gap-1.5"
            >
              <span className="text-ink-muted">{c.category}</span>
              <span className="font-mono font-semibold text-ink">{pct(c.accuracy)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
