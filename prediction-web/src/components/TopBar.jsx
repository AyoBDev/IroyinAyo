import useStore from '../store.js';

export default function TopBar({ onPositionsClick }) {
  const user = useStore((s) => s.user);

  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 100,
    }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🏆 Hackathon Predictions</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>
            💰 {user.points_balance} pts
          </span>
        )}
        <button
          onClick={onPositionsClick}
          style={{
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem',
            border: '1px solid var(--border)',
          }}
        >
          My Bets
        </button>
      </div>
    </header>
  );
}
