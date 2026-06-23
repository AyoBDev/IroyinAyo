'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cc } from '@/lib/api';
import { track } from '@/lib/telemetry';

export function BotReconnectDialog({ online, lastConnectedAt, onClose }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleReconnect() {
    setBusy(true);
    try {
      const r = await cc.reconnectBot();
      track('cc_bot_reconnect_triggered', { result_status: r.status });
      setResult(r);
    } catch (err) {
      setResult({ status: 'failed', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>WhatsApp bot</DialogTitle>
        <DialogDescription>
          {online === true && 'Bot socket is currently online.'}
          {online === false && 'Bot socket is offline.'}
          {online === null && 'Bot status unknown.'}
          {lastConnectedAt && (
            <div className="text-xs mt-1">Last connected: {new Date(lastConnectedAt).toLocaleString()}</div>
          )}
        </DialogDescription>
        <div className="mt-3 flex gap-2">
          <Button onClick={handleReconnect} disabled={busy}>Reconnect</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {result && (
          <div className="mt-3 text-sm">
            <div className="font-medium">{result.status}</div>
            <div className="text-muted-foreground">{result.message}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
