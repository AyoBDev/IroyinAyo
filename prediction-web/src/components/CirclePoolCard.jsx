import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

function formatRelative(date) {
  const ms = new Date(date).getTime() - Date.now();
  const abs = Math.abs(ms);
  const future = ms > 0;
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  if (abs < 60000) return future ? 'starting now' : 'just now';
  if (hours === 0) return future ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24) return future ? `in ${hours}h ${minutes}m` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

export default function CirclePoolCard({ pool, circleId }) {
  const navigate = useNavigate();
  const title = pool.title || (pool.pool_type === 'public' ? 'Match prediction' : 'Pool');
  const statusBadge = {
    open: { label: 'Open', icon: Clock, color: 'text-emerald' },
    closed: { label: 'Resolving', icon: Clock, color: 'text-ink-muted' },
    awaiting_dispute_window: { label: 'Awaiting review', icon: Clock, color: 'text-accent-yellow' },
    disputed: { label: 'Disputed', icon: AlertCircle, color: 'text-accent-red' },
    resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-accent-green' },
  }[pool.status] || { label: pool.status, icon: Clock, color: 'text-ink-muted' };
  const Icon = statusBadge.icon;

  return (
    <button
      onClick={() => navigate(`/circles/${circleId}/pools/${pool.id}`)}
      className="bg-paper border border-line rounded-2xl p-4 text-left w-full hover:bg-paper-hover transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="font-semibold text-[14px] line-clamp-2 flex-1">{title}</div>
        <div className={`flex items-center gap-1 text-[11px] font-medium ${statusBadge.color}`}>
          <Icon size={11} /> {statusBadge.label}
        </div>
      </div>
      <div className="flex items-center gap-3 text-[12px] text-ink-muted">
        <span>{pool.stake_amount} pts stake</span>
        <span>·</span>
        <span>{formatRelative(pool.kickoff_at)}</span>
      </div>
    </button>
  );
}
