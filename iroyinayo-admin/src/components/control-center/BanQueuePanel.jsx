'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function BanQueuePanel() {
  const { data, error, refresh } = usePolling(cc.getBannedStudents, 30000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const items = data?.items || [];

  async function handleUnban(id) {
    setErrInline(null);
    try { await cc.unbanStudent(id); refresh(); }
    catch (err) { setErrInline({ id, message: err.message }); }
  }

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Recent bans</div>
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && items.length === 0 && <EmptyState />}
          {items.map((u) => (
            <div key={u.id} className="border border-border rounded p-2">
              <div className="text-sm font-medium">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.phone_number}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => handleUnban(u.id)}>Unban</Button>
                <Link href={`/students/${u.id}`}><Button size="sm" variant="ghost">Investigate</Button></Link>
              </div>
              {errInline?.id === u.id && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
