'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function ResolveMarketsPanel() {
  const { data, error, refresh } = usePolling(cc.getClosedMarkets, 30000);
  const [openId, setOpenId] = useState(null);
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];
  const closed = items.filter((m) => m.status === 'closed');

  async function handleResolve(marketId, outcomeId) {
    setErrInline(null);
    try {
      await cc.resolveMarket(marketId, outcomeId);
      setOpenId(null);
      refresh();
    } catch (err) {
      setErrInline({ marketId, message: err.message });
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Markets to resolve</div>
        <Badge variant="secondary">{closed.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && closed.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {closed.map((m) => (
          <div key={m.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{m.title}</div>
            <div className="text-xs text-muted-foreground">Closed · {m.outcomes?.length || 0} outcomes</div>
            {openId === m.id ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {(m.outcomes || []).map((o) => (
                  <Button key={o.id} size="sm" onClick={() => handleResolve(m.id, o.id)}>
                    Winner: {o.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => setOpenId(m.id)}>Pick winner</Button>
            )}
            {errInline?.marketId === m.id && (
              <div className="text-xs text-red-600 mt-1">{errInline.message}</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
