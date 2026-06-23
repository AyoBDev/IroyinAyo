'use client';
export function HealthStrip() {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex gap-3 overflow-x-auto">
      <div className="text-sm text-muted-foreground">System Health (loading…)</div>
    </div>
  );
}
