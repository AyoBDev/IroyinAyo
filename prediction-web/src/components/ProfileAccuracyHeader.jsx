import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

function pct(x) {
  return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`;
}

function relativeTime(ts) {
  const diff = new Date(ts).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.round(mins / 60)}h`;
}

export default function ProfileAccuracyHeader({ userId, isOwn }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch(`/api/habit/accuracy/${userId}`)
      .then(setData)
      .catch(() => setData(null));
  }, [userId]);

  if (!data) {
    return (
      <section className="px-4 pt-2 pb-4">
        <div className="font-mono mono-label text-ink-muted">Loading…</div>
      </section>
    );
  }

  const hero = data.allTime.accuracy === null ? 'New caller' : pct(data.allTime.accuracy);
  const heroSub = data.allTime.accuracy === null ? '' : `RESOLVED CALLS · ${data.allTime.resolvedCalls}`;

  return (
    <section className="px-4 pt-2 pb-4">
      {/* Hero accuracy */}
      <div>
        <div className="font-serif text-hero leading-none">{hero}</div>
        {heroSub && <div className="mt-2 font-mono mono-label text-ink-muted">{heroSub}</div>}
      </div>

      {/* 30d row */}
      {data.last30Days.accuracy !== null && (
        <div className="mt-3 font-mono mono-data text-ink-muted">
          30D · {pct(data.last30Days.accuracy)} · {data.last30Days.resolvedCalls} calls
        </div>
      )}

      {/* Category strip */}
      {data.byCategory.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto -mx-4 px-4">
          {data.byCategory.map((c) => (
            <div key={c.category} className="shrink-0 bg-paper border border-line rounded-full px-3 py-1.5">
              <span className="font-sans label-sm">{c.category} </span>
              <span className="font-mono">{pct(c.accuracy)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rank */}
      {data.rank.rank !== null && (() => {
        const topPercent = Math.max(1, Math.ceil((data.rank.rank / data.rank.totalRanked) * 100));
        return (
          <div className="mt-3 font-sans label-sm text-ink-muted">
            Rank #{data.rank.rank} of {data.rank.totalRanked}{topPercent <= 50 ? ` · top ${topPercent}% on accuracy` : ''}
          </div>
        );
      })()}

      {/* Open calls (visible on own profile) */}
      {isOwn && (
        <div className="mt-2 font-sans label-sm text-ink-muted">
          {data.openCallsCount} open calls{data.nextResolutionAt ? ` · next resolves ${relativeTime(data.nextResolutionAt)}` : ''}
        </div>
      )}
    </section>
  );
}
