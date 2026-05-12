import useStore from '../store.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const leaderboard = useStore((s) => s.leaderboard);
  const user = useStore((s) => s.user);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      padding: '1.5rem', marginTop: '1rem', border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>🏆 Leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No rankings yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {leaderboard.map((entry, i) => {
            const isMe = user && entry.id === user.id;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.75rem', borderRadius: '6px',
                  background: isMe ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: isMe ? '1px solid var(--accent-blue)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>
                  {MEDALS[i] || `${i + 1}.`} {entry.name}
                  {isMe && <span style={{ color: 'var(--accent-blue)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>(you)</span>}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {Number(entry.total_points)} pts
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
