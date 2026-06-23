'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';
import { track } from '@/lib/telemetry';

export function PendingUserMarketsPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingMarkets, 30000);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];
  const pending = items.filter((m) => m.status === 'pending');

  async function handleApprove(id) {
    setErrInline(null);
    try {
      await cc.approveMarket(id);
      track('cc_user_market_approved', { market_id: id });
      refresh();
    }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  async function handleReject(id) {
    if (reason.trim().length < 3) {
      setErrInline({ id, message: 'Reason required (min 3 chars)' });
      return;
    }
    setErrInline(null);
    try {
      await cc.rejectMarket(id, reason.trim());
      track('cc_user_market_rejected', { market_id: id, reason: reason.trim() });
      setRejectingId(null);
      setReason('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending user markets</div>
        <Badge variant="secondary">{pending.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && pending.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {pending.map((m) => (
          <div key={m.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{m.title}</div>
            <div className="text-xs text-muted-foreground">by {m.creator_name || 'unknown'}</div>
            {rejectingId === m.id ? (
              <div className="mt-2 space-y-2">
                <Input placeholder="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleReject(m.id)}>Confirm reject</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setReason(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleApprove(m.id)}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectingId(m.id)}>Reject</Button>
              </div>
            )}
            {errInline?.id === m.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
