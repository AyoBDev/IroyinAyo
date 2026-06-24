'use client';

import { useState, useEffect, useRef } from 'react';
import { cc } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const CONFIRM_PHRASE = 'RESET SESSION';
const POLL_INTERVAL_MS = 3000;

export default function BotSettingsPage() {
  const [qrStatus, setQrStatus] = useState({ status: 'waiting', qrDataUrl: null });
  const [polling, setPolling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const pollRef = useRef(null);

  async function loadStatus() {
    try {
      const data = await cc.getBotQr();
      setQrStatus(data);
      if (data.status === 'connected' && polling) {
        setPolling(false);
        setMessage({ kind: 'success', text: 'Bot is connected. Pairing complete.' });
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (polling) {
      pollRef.current = setInterval(loadStatus, POLL_INTERVAL_MS);
      return () => clearInterval(pollRef.current);
    }
  }, [polling]);

  async function handleReset() {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      setMessage({ kind: 'error', text: `Type "${CONFIRM_PHRASE}" exactly to confirm.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await cc.resetBotSession();
      setShowConfirm(false);
      setConfirmText('');
      setMessage({ kind: 'success', text: 'Session cleared. A new QR code will appear below within 10 seconds — scan it from the bot phone.' });
      setPolling(true);
      setTimeout(loadStatus, 2000);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const connected = qrStatus.status === 'connected';
  const hasQr = qrStatus.status === 'needs_pairing' && qrStatus.qrDataUrl;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bot Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the WhatsApp bot session. Use this when the bot has been force-logged out by WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
          <CardDescription>
            {connected
              ? 'Bot is connected to WhatsApp.'
              : hasQr
              ? 'Bot is waiting for QR scan.'
              : 'Bot is not connected. Reset the session below to get a fresh QR code.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span
              className={
                'inline-block w-2.5 h-2.5 rounded-full ' +
                (connected ? 'bg-green-500' : hasQr ? 'bg-yellow-500' : 'bg-red-500')
              }
            />
            <span className="text-sm font-medium capitalize">
              {connected ? 'Connected' : hasQr ? 'Awaiting pairing' : 'Disconnected'}
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={loadStatus} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasQr && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Scan QR code</CardTitle>
            <CardDescription>
              On the bot's WhatsApp phone: Settings → Linked Devices → Link a device → scan this code. QR codes expire after about 60 seconds; the page auto-refreshes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-4 bg-white rounded-md border border-border">
              <img src={qrStatus.qrDataUrl} alt="WhatsApp pairing QR" className="max-w-xs" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Reset bot session
          </CardTitle>
          <CardDescription>
            Use this only when WhatsApp has logged the bot out. This clears stored credentials and starts a fresh pairing flow. The bot will be offline until you scan the new QR code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowConfirm(true)}
            disabled={busy}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset session
          </Button>
        </CardContent>
      </Card>

      {message && (
        <div
          className={
            'mt-6 px-4 py-3 rounded-md text-sm flex items-start gap-2 ' +
            (message.kind === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-destructive/10 text-destructive border border-destructive/30')
          }
        >
          {message.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) { setShowConfirm(false); setConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset bot session?</DialogTitle>
            <DialogDescription>
              This will disconnect the bot and clear stored credentials. You'll need to scan a fresh QR code from the bot phone to bring it back online. Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={busy || confirmText.trim() !== CONFIRM_PHRASE}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reset session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
