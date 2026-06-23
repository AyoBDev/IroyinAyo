'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

function isUrgent() {
  // 7:30am WAT = 06:30 UTC
  const now = new Date();
  const utcHr = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  return (utcHr > 6) || (utcHr === 6 && utcMin >= 30);
}

export function PendingContentPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingContent, 30000);
  const [errInline, setErrInline] = useState(null);
  const urgent = isUrgent();

  const items = Array.isArray(data) ? data : data?.items || [];

  async function handleApprove(id) {
    setErrInline(null);
    try { await cc.approveContent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }
  async function handlePublish(id) {
    setErrInline(null);
    try { await cc.publishContent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending content</div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && items.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className={`border-l-4 ${urgent ? 'border-orange-500' : 'border-border'} border-y border-r border-border rounded p-2`}>
            <div className="text-sm font-medium">{c.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{c.summary || c.body || ''}</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => handleApprove(c.id)}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => handlePublish(c.id)}>Publish</Button>
            </div>
            {errInline?.id === c.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
