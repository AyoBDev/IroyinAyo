import { Activity, Zap } from 'lucide-react';
import useStore from '../store.js';

export default function ActivityFeed() {
  const feed = useStore((s) => s.feed);

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden">
      <div className="px-4 py-3.5 border-b border-line flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        <Activity size={13} className="text-ink-muted" />
        <h3 className="font-serif text-xs uppercase tracking-wide text-ink-muted">Live</h3>
      </div>

      <div className="max-h-[350px] overflow-auto">
        {feed.length === 0 ? (
          <div className="py-7 px-4 text-center">
            <Zap size={20} className="text-ink-muted mb-2" />
            <p className="text-ink-muted text-xs">
              Waiting for predictions...
            </p>
          </div>
        ) : (
          <div className="p-1.5">
            {feed.map((item, i) => (
              <div
                key={`${item.timestamp}-${i}`}
                className={`text-xs text-ink-muted py-2 px-2.5 rounded-md my-0.5 ${i === 0 ? 'animate-fade-in bg-paper-hover' : ''}`}
              >
                <span className="text-accent-green mr-1.5 text-[8px]">●</span>
                <strong className="text-ink font-semibold">{item.amount} pts</strong>
                {' on '}
                <strong className="text-ink font-semibold">{item.outcomeLabel}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
