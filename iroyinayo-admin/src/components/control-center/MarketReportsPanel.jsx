'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function MarketReportsPanel() {
  const { data, error, refresh } = usePolling(cc.getMarketReports, 30000);
  const [open, setOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = data?.items || [];

  async function handleDismiss(id) {
    setErrInline(null);
    try { await cc.updateMarketReport(id, { action: 'dismiss' }); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  async function handleResolve(id) {
    setErrInline(null);
    try {
      await cc.updateMarketReport(id, { action: 'resolve', note: note || undefined });
      setResolvingId(null);
      setNote('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Market reports</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((r) => (
            <div key={r.id} className="border border-border rounded p-2">
              <div className="text-sm font-medium">{r.market_title}</div>
              <div className="text-xs text-muted-foreground">reported by {r.reporter_name}: {r.reason}</div>
              {resolvingId === r.id ? (
                <div className="mt-2 space-y-2">
                  <Input placeholder="Resolution note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResolve(r.id)}>Confirm resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResolvingId(null); setNote(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setResolvingId(r.id)}>Resolve</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(r.id)}>Dismiss</Button>
                </div>
              )}
              {errInline?.id === r.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
