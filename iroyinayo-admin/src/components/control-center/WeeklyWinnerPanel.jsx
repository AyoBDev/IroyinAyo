'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';
import { EmptyState } from './EmptyState';

export function WeeklyWinnerPanel() {
  const { data, error, refresh } = usePolling(cc.getWeeklyWinnerStatus, 60000);
  const [open, setOpen] = useState(false);
  const [errInline, setErrInline] = useState(null);
  const winner = data?.winner;

  async function handleMarkPaid() {
    if (!winner) return;
    setErrInline(null);
    try {
      const weekStart = typeof winner.weekStart === 'string' ? winner.weekStart : new Date(winner.weekStart).toISOString();
      await cc.markWeeklyWinnerPaid(weekStart);
      refresh();
    } catch (err) { setErrInline({ message: err.message }); }
  }

  const needsAction = winner && !winner.prizePaid;

  return (
    <Card className="p-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">Weekly winner</div>
        <Badge variant="secondary">{needsAction ? 1 : 0}</Badge>
      </button>
      {open && (
        <div className="mt-3">
          {error && <div className="text-sm text-red-600">Failed to load.</div>}
          {!error && !winner && <EmptyState label="No winner this week yet." />}
          {!error && winner && !needsAction && <EmptyState label="Prize already paid ✓" />}
          {!error && needsAction && (
            <div className="border border-border rounded p-2">
              <div className="text-sm font-medium">{winner.winnerName}</div>
              <div className="text-xs text-muted-foreground">won {winner.winnerProfit} pts</div>
              <Button size="sm" className="mt-2" onClick={handleMarkPaid}>Mark prize paid</Button>
              {errInline && (<div className="text-xs text-red-600 mt-1">{errInline.message}</div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
