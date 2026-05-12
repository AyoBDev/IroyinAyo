import useStore from '../store.js';

export default function ActivityFeed() {
  const feed = useStore((s) => s.feed);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      padding: '1.25rem', border: '1px solid var(--border)', maxHeight: '600px', overflow: 'hidden',
    }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Live Activity
      </h3>
      {feed.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Waiting for bets...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {feed.map((item, i) => (
            <div
              key={`${item.timestamp}-${i}`}
              style={{
                fontSize: '0.85rem', color: 'var(--text-secondary)',
                padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '6px',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              🎯 Someone bet <strong style={{ color: 'var(--text-primary)' }}>{item.amount} pts</strong> on{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{item.outcomeLabel}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
