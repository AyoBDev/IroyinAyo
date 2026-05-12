import useStore from '../store.js';

export default function MyPositions({ onClose }) {
  const positions = useStore((s) => s.positions);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      padding: '1.5rem', margin: '1rem 1.5rem', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>🔮 My Bets</h3>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>×</button>
      </div>

      {positions.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No bets yet. Tap a team to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {positions.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '0.75rem', background: 'var(--bg-primary)',
                borderRadius: '8px', border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {p.market_title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{p.outcome_label}</span>
                {p.market_status === 'resolved' ? (
                  <span style={{ color: p.payout > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                    {p.payout > 0 ? `Won ${p.payout} pts` : 'Lost'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {p.amount} pts → ~{Math.floor(p.shares)} if wins
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
