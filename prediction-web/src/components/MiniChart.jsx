export default function MiniChart({ outcomes }) {
  if (!outcomes || outcomes.length === 0) return null;

  const sorted = [...outcomes].sort((a, b) => b.price - a.price).slice(0, 8);
  const maxPrice = sorted[0]?.price || 1;

  return (
    <div className="flex items-end gap-0.5 h-8">
      {sorted.map((o, i) => {
        const height = Math.max(3, (o.price / maxPrice) * 28);
        const colorClass = i === 0 ? 'bg-accent-green' : i === 1 ? 'bg-emerald' : 'bg-line';
        return (
          <div
            key={o.id}
            title={`${o.label}: ${Math.round(o.price * 100)}%`}
            className={`w-1.5 rounded-sm transition-all duration-400 ease-out ${colorClass} ${i >= 3 ? 'opacity-60' : ''}`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}
