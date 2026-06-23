'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

const SEV_COLORS = { high: 'destructive', medium: 'default', low: 'secondary' };

export function SimulationAlertsPanel() {
  const { data, error, refresh } = usePolling(cc.getSimulationAlerts, 30000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const items = Array.isArray(data) ? data : data?.items || data?.alerts || [];

  async function handleUpdate(id, status) {
    setErrInline(null);
    try { await cc.updateSimulationAlert(id, { status }); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Simulation alerts</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((a) => (
            <div key={a.id} className="border border-border rounded p-2">
              <div className="flex items-center gap-2">
                <Badge variant={SEV_COLORS[a.severity] || 'default'}>{a.severity}</Badge>
                <div className="text-sm font-medium">{a.alert_type}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">market {a.market_id}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleUpdate(a.id, 'acknowledged')}>Acknowledge</Button>
                <Button size="sm" variant="ghost" onClick={() => handleUpdate(a.id, 'dismissed')}>Dismiss</Button>
              </div>
              {errInline?.id === a.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
