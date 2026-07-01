import useStore from '../store.js';

export default function CrewLeaderboardRow({ member, rank }) {
  const user = useStore((s) => s.user);
  const isCurrentUser = member.student_id === user?.id;

  const initial = member.name?.[0]?.toUpperCase() || '?';
  const netColor = member.net_points > 0 ? 'text-accent-green' : member.net_points < 0 ? 'text-accent-red' : 'text-ink-muted';
  const netPrefix = member.net_points > 0 ? '+' : '';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border border-line ${isCurrentUser ? 'bg-accent-green-bg' : 'bg-paper'} hover:bg-paper-hover`}>
      <div className="text-[24px] font-bold font-mono text-ink-muted min-w-[32px] text-center">{rank}</div>
      <div className="w-10 h-10 rounded-full bg-emerald text-white flex items-center justify-center font-medium flex-shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-ink truncate">{member.name}</div>
      </div>
      <div className="text-right">
        <div className={`text-[15px] font-medium ${netColor}`}>
          {netPrefix}{member.net_points} pts
        </div>
        {member.accuracy !== null ? (
          <div className="text-[11px] font-mono text-ink-muted">{member.accuracy}%</div>
        ) : (
          <div className="text-[11px] font-mono text-ink-muted">—</div>
        )}
      </div>
    </div>
  );
}
