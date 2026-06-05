import { Crown } from 'lucide-react';
import useStore from '../store.js';

export default function Leaderboard() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden">
      <div className="py-3.5 px-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown size={13} className="text-accent-yellow" />
          <h3 className="font-serif text-xs uppercase tracking-wide text-ink-muted">
            Top Predictors
          </h3>
        </div>
        <span className="text-[10px] text-ink-muted font-medium">Weekly</span>
      </div>

      {leaderboard.length === 0 ? (
        <div className="py-7 px-4 text-center">
          <p className="text-ink-muted text-xs">No rankings yet</p>
        </div>
      ) : (
        <div className="p-1.5">
          {leaderboard.map((entry, i) => {
            const isMe = user && entry.id === user.id;
            const rankColors = ['#facc15', '#94a3b8', '#d97706'];
            return (
              <div
                key={entry.id}
                className={`flex justify-between items-center py-2 px-3 rounded-md my-0.5 ${
                  isMe ? 'bg-accent-green-bg border border-accent-green-border' : 'border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[11px] w-5 h-5 flex items-center justify-center rounded-full font-extrabold"
                    style={{
                      background: i < 3 ? `${rankColors[i]}15` : undefined,
                      color: i < 3 ? rankColors[i] : undefined,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium">
                    {entry.name}
                    {isMe && <span className="text-emerald ml-1.5 text-[10px] font-semibold">you</span>}
                  </span>
                </div>
                <span className={`font-bold text-xs font-mono ${i < 3 ? 'text-accent-green' : 'text-ink-muted'}`}>
                  {entry.netProfit ?? entry.total_points ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
