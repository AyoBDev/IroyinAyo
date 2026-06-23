export function EmptyState({ label = 'All clear ✓' }) {
  return (
    <div className="flex items-center justify-center py-6 text-emerald-600 font-serif text-lg">
      {label}
    </div>
  );
}
