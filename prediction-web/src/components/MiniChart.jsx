export default function MiniChart({ outcomes }) {
  if (!outcomes || outcomes.length === 0) return null;

  const sorted = [...outcomes].sort((a, b) => b.price - a.price).slice(0, 8);
  const maxPrice = sorted[0]?.price || 1;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: '2px',
      height: '32px',
    }}>
      {sorted.map((o, i) => {
        const height = Math.max(3, (o.price / maxPrice) * 28);
        return (
          <div
            key={o.id}
            title={`${o.label}: ${Math.round(o.price * 100)}%`}
            style={{
              width: '6px',
              height: `${height}px`,
              background: i === 0 ? 'var(--accent-green)' : i === 1 ? 'var(--accent-blue)' : 'var(--border-light)',
              borderRadius: '2px',
              transition: 'height 0.4s ease',
              opacity: i < 3 ? 1 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
