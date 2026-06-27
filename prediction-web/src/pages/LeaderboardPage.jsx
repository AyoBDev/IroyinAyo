import { useEffect, useState } from 'react';
import { Crown, Target, TrendingUp, ChevronDown } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';

function PodiumUser({ entry, rank, size }) {
  const initial = entry.name?.charAt(0)?.toUpperCase() || '?';

  const avatarSize = size === 'lg' ? 'w-[72px] h-[72px]' : size === 'md' ? 'w-[60px] h-[60px]' : 'w-[52px] h-[52px]';
  const fontSize = size === 'lg' ? 'text-[28px]' : size === 'md' ? 'text-[22px]' : 'text-[20px]';
  const badgeSize = size === 'lg' ? 'w-[26px] h-[26px]' : 'w-[22px] h-[22px]';

  const borderClass = rank === 1 ? 'border-accent-green/30' : rank === 2 ? 'border-line' : 'border-accent-yellow/30';
  const bgClass = rank === 1 ? 'bg-accent-green-bg' : rank === 2 ? 'bg-paper' : 'bg-accent-yellow-bg';
  const colorClass = rank === 1 ? 'text-accent-green' : rank === 2 ? 'text-ink-muted' : 'text-accent-yellow';

  const totalWon = entry.totalWon ?? 0;
  const wins = entry.wins ?? 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-2">
        {rank === 1 && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2">
            <Crown size={22} className="text-accent-yellow fill-accent-yellow" />
          </div>
        )}
        <div className={`${avatarSize} rounded-full border-[3px] ${borderClass} ${bgClass} flex items-center justify-center`}>
          <span className={`${fontSize} font-extrabold ${colorClass}`}>
            {initial}
          </span>
        </div>
        <div className={`absolute -bottom-1 -right-1 ${badgeSize} rounded-full ${bgClass} border-2 border-bone flex items-center justify-center text-[10px] font-extrabold ${colorClass}`}>
          {rank}
        </div>
      </div>
      <p className="text-xs font-semibold text-ink text-center max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap">
        {entry.name}
      </p>
      <p className={`font-mono text-xs font-bold mt-0.5 ${wins > 0 ? 'text-accent-green' : 'text-ink-muted'}`}>
        {wins} {wins === 1 ? 'win' : 'wins'}
      </p>
      {totalWon > 0 && (
        <p className="font-mono text-[10px] text-ink-muted mt-0.5">
          +{totalWon} pts
        </p>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);
  const [pastWeeks, setPastWeeks] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    apiFetch('/api/multi-markets/leaderboard/history')
      .then(setPastWeeks)
      .catch(() => {});
  }, []);

  const myVisibleEntry = leaderboard.find(e => user && e.id === user.id);
  const myStanding = myVisibleEntry || (user ? {
    rank: user.weekly_rank,
    wins: user.weekly_wins ?? 0,
    totalWon: user.weekly_total_won ?? 0,
    predictions: user.weekly_predictions ?? 0,
  } : null);
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="p-4 max-w-[700px] mx-auto pb-[100px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-serif text-section font-semibold text-ink">Leaderboard</h2>
        <span className="text-[11px] text-ink-muted uppercase tracking-wide">
          Resets Monday
        </span>
      </div>

      {leaderboard.length === 0 ? (
        <div className="py-10 px-5 text-center">
          <TrendingUp size={28} className="text-ink-muted mb-3 mx-auto" />
          <p className="text-ink-muted text-sm mb-1.5">
            Be the first on the leaderboard!
          </p>
          <p className="text-ink-muted text-xs">
            Make 3+ predictions this week to qualify for the cash prize.
          </p>
        </div>
      ) : (
        <>
          {/* Podium Top 3 */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 items-end gap-2 mb-6 pt-5 px-2">
              <div className="pt-6">
                <PodiumUser entry={top3[1]} rank={2} size="md" />
              </div>
              <div>
                <PodiumUser entry={top3[0]} rank={1} size="lg" />
              </div>
              <div className="pt-8">
                <PodiumUser entry={top3[2]} rank={3} size="sm" />
              </div>
            </div>
          )}

          {/* List (4th onwards) */}
          {rest.length > 0 && (
            <div className="mb-4">
              {/* Header row */}
              <div className="flex items-center px-5 py-2 text-[11px] font-medium text-ink-muted uppercase tracking-wide">
                <span className="w-7">#</span>
                <span className="flex-1 ml-3">User</span>
                <span className="w-[50px] text-right">Wins</span>
                <span className="w-[80px] text-right">Won</span>
              </div>

              <div className="flex flex-col gap-2">
                {rest.map((entry) => {
                  const rank = entry.rank;
                  const isMe = user && entry.id === user.id;
                  const totalWon = entry.totalWon ?? 0;
                  const wins = entry.wins ?? 0;
                  const predictions = entry.predictions ?? 0;

                  return (
                    <div key={entry.id} className={`flex items-center px-5 py-3 rounded-2xl border ${isMe ? 'bg-accent-green-bg border-emerald/30' : 'bg-paper border-line'}`}>
                      <span className="w-7 text-xs font-semibold text-ink-muted">
                        {rank}
                      </span>
                      <div className="flex-1 flex items-center gap-2.5 ml-3">
                        <div className="w-9 h-9 rounded-full bg-paper flex items-center justify-center">
                          <span className="text-sm font-bold text-ink-muted">
                            {entry.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-ink">
                            {entry.name}
                            {isMe && <span className="text-emerald ml-1.5 text-[10px] font-semibold">you</span>}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 leading-none">
                            <Target size={11} strokeWidth={2.5} className="text-ink-muted shrink-0" />
                            <span className="text-[10px] text-ink-muted">
                              {predictions} {predictions === 1 ? 'prediction' : 'predictions'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`font-mono w-[50px] text-right text-xs font-semibold ${wins > 0 ? 'text-ink' : 'text-ink-muted'}`}>
                        {wins}
                      </span>
                      <span className={`font-mono w-[80px] text-right text-xs font-bold ${totalWon > 0 ? 'text-accent-green' : 'text-ink-muted'}`}>
                        {totalWon > 0 ? `+${totalWon}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Your Ranking */}
          {user && (
            <div className="mt-6 pt-6 border-t border-line">
              <p className="text-[11px] font-medium text-ink-muted uppercase tracking-widest text-center mb-3">
                Your Ranking
              </p>
              <div className="flex items-center px-5 py-4 bg-accent-green-bg border border-emerald/30 rounded-2xl">
                <span className="w-7 text-xs font-bold text-emerald">
                  {myStanding?.rank ?? '—'}
                </span>
                <div className="flex-1 flex items-center gap-2.5 ml-3">
                  <div className="w-9 h-9 rounded-full bg-accent-green-bg border-2 border-emerald/30 flex items-center justify-center">
                    <span className="text-sm font-extrabold text-emerald">
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-emerald">
                      {user.name} (You)
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 leading-none">
                      <Target size={11} strokeWidth={2.5} className="text-emerald shrink-0" />
                      <span className="text-[10px] text-ink-muted">
                        {myStanding?.predictions || 0} {(myStanding?.predictions || 0) === 1 ? 'prediction' : 'predictions'}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="font-mono w-[50px] text-right text-xs font-semibold text-emerald">
                  {myStanding?.wins ?? 0}
                </span>
                <span className={`font-mono w-[80px] text-right text-xs font-bold ${(myStanding?.totalWon ?? 0) > 0 ? 'text-accent-green' : 'text-ink-muted'}`}>
                  {(myStanding?.totalWon ?? 0) > 0 ? `+${myStanding.totalWon}` : '—'}
                </span>
              </div>
              {(!myStanding || myStanding.wins === 0) && (
                <p className="text-[11px] text-ink-muted text-center mt-2">
                  Make a winning prediction this week to climb the table.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Past Winners */}
      {pastWeeks.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted bg-transparent py-2"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
            Past weeks
          </button>
          {showHistory && (
            <div className="flex flex-col gap-2 mt-2">
              {pastWeeks.map((week) => (
                <div key={week.id} className="bg-paper rounded-lg border border-line px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-ink-muted">
                      {new Date(week.week_start).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} — {new Date(week.week_end).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-[13px] font-semibold mt-0.5">
                      {week.winner_name || 'No winner'}
                    </div>
                  </div>
                  {week.winner_profit > 0 && (
                    <span className="font-mono text-[13px] font-bold text-accent-green">
                      +{week.winner_profit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
