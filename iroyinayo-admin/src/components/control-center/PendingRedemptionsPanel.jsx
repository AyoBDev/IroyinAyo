'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function PendingRedemptionsPanel() {
  const { data, error, refresh } = usePolling(cc.getPendingRedemptions, 30000);
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState('');
  const [errInline, setErrInline] = useState(null);

  const items = Array.isArray(data) ? data : data?.items || [];

  async function handleFulfill(id) {
    setErrInline(null);
    try {
      await cc.fulfillRedemption(id, notes ? { notes } : {});
      setActiveId(null);
      setNotes('');
      refresh();
    } catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Pending redemptions</div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load.</div>}
      {!error && items.length === 0 && <EmptyState />}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="border border-border rounded p-2">
            <div className="text-sm font-medium">{r.student_name || r.user_name || 'User'} → {r.reward_name || 'reward'}</div>
            <div className="text-xs text-muted-foreground">{r.points_cost || r.points || ''} pts</div>
            {activeId === r.id ? (
              <div className="mt-2 space-y-2">
                <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleFulfill(r.id)}>Confirm fulfilled</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setNotes(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => setActiveId(r.id)}>Mark fulfilled</Button>
            )}
            {errInline?.id === r.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
          </div>
        ))}
      </div>
    </Card>
  );
}
