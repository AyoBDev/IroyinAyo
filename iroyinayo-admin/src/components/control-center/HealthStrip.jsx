'use client';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { BotStatusPill } from './BotStatusPill';

export function HealthStrip() {
  const { data } = usePolling(cc.getHealth, 10000);
  const h = data || {};
  const q = h.todayQueue || { sent: 0, failed: 0, skipped: 0, pending: 0 };
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex gap-3 overflow-x-auto items-center">
      <BotStatusPill online={h.botOnline ?? null} lastConnectedAt={h.botLastConnectedAt} />
      <Badge variant="secondary">Today: {q.sent} sent · {q.failed} failed · {q.skipped} skipped · {q.pending} pending</Badge>
      <Badge variant="secondary">Open markets: {h.openMarketsCount ?? 0}</Badge>
      <Badge variant="secondary">DAU: {h.dauToday ?? 0}</Badge>
      <Badge variant="secondary">Triggers: {h.pendingPositionTriggers ?? 0}</Badge>
    </div>
  );
}
