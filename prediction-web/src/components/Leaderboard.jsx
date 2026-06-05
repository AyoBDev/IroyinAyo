import { Crown } from 'lucide-react';
import useStore from '../store.js';

export default function Leaderboard() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crown size={13} color="var(--accent-yellow)" />
          <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
            Top Predictors
          </h3>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Weekly</span>
      </div>

      {leaderboard.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No rankings yet</p>
        </div>
      ) : (
        <div style={{ padding: '6px' }}>
          {leaderboard.map((entry, i) => {
            const isMe = user && entry.id === user.id;
            const rankColors = ['#facc15', '#94a3b8', '#d97706'];
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: 'var(--radius)',
                  background: isMe ? 'var(--accent-blue-bg)' : 'transparent',
                  border: isMe ? '1px solid var(--accent-blue-border)' : '1px solid transparent',
                  margin: '2px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '11px', width: '20px', height: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: i < 3 ? `${rankColors[i]}15` : 'var(--bg-secondary)',
                    color: i < 3 ? rankColors[i] : 'var(--text-tertiary)',
                    fontWeight: 800,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>
                    {entry.name}
                    {isMe && <span style={{ color: 'var(--accent-blue)', marginLeft: '6px', fontSize: '10px', fontWeight: 600 }}>you</span>}
                  </span>
                </div>
                <span style={{
                  fontWeight: 700, fontSize: '12px',
                  color: i < 3 ? 'var(--accent-green)' : 'var(--text-secondary)',
                }}>
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
