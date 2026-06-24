'use client';

import { useState, useRef } from 'react';
import { cc } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, ImagePlus, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const CONFIRM_PHRASE = 'SEND TO ALL';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function BroadcastPage() {
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testSucceeded, setTestSucceeded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus({ kind: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ kind: 'error', text: 'Image must be under 10 MB.' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setTestSucceeded(false);
    setStatus(null);
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setTestSucceeded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function buildPayload() {
    const payload = { caption };
    if (imageFile) {
      payload.imageBase64 = await fileToBase64(imageFile);
    }
    return payload;
  }

  async function handleTest() {
    if (!testPhone.trim()) {
      setStatus({ kind: 'error', text: 'Enter a phone number for the test send.' });
      return;
    }
    if (!caption && !imageFile) {
      setStatus({ kind: 'error', text: 'Add a caption or attach an image first.' });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload = await buildPayload();
      payload.phone = testPhone.trim();
      const res = await cc.broadcastTest(payload);
      setTestSucceeded(true);
      setStatus({ kind: 'success', text: `Test sent to ${res.recipient}. Check WhatsApp before sending to all.` });
    } catch (err) {
      setTestSucceeded(false);
      setStatus({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendAll() {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      setStatus({ kind: 'error', text: `Type "${CONFIRM_PHRASE}" exactly to confirm.` });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload = await buildPayload();
      payload.confirm = 'YES_SEND_TO_ALL';
      const res = await cc.broadcastAll(payload);
      setShowConfirmDialog(false);
      setConfirmText('');
      setStatus({ kind: 'success', text: res.message || 'Broadcast started. Check server logs for progress.' });
    } catch (err) {
      setStatus({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const canTest = !busy && (caption || imageFile) && testPhone.trim();
  const canSendAll = !busy && testSucceeded && (caption || imageFile);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a WhatsApp announcement (with optional image) to every non-banned student.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Pacing is automatic: 3–8s between sends, 30–60s pause every 50 messages — protects the bot from WhatsApp rate limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => { setCaption(e.target.value); setTestSucceeded(false); }}
              placeholder="🚨 Your announcement text..."
              rows={8}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">{caption.length} characters</p>
          </div>

          <div>
            <Label>Image (optional)</Label>
            {!imagePreview ? (
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="broadcast-image-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Choose image
                </Button>
                <p className="text-xs text-muted-foreground mt-2">PNG/JPG up to 10 MB.</p>
              </div>
            ) : (
              <div className="mt-2 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Broadcast preview"
                  className="max-h-64 rounded-md border border-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">{imageFile?.name} · {(imageFile?.size / 1024).toFixed(0)} KB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Step 1 — Dry run</CardTitle>
          <CardDescription>Send to one phone first to verify the preview.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="test-phone">Test phone (international, no +)</Label>
              <Input
                id="test-phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="2347055885094"
                className="mt-2"
              />
            </div>
            <Button onClick={handleTest} disabled={!canTest}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Step 2 — Send to all students</CardTitle>
          <CardDescription>
            Available after a successful test. Runs in the background — you'll see progress in server logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canSendAll}
          >
            <Send className="h-4 w-4 mr-2" />
            Send to all
          </Button>
          {!testSucceeded && (
            <p className="text-xs text-muted-foreground mt-2">Run a successful test first.</p>
          )}
        </CardContent>
      </Card>

      {status && (
        <div
          className={
            'mt-6 px-4 py-3 rounded-md text-sm flex items-start gap-2 ' +
            (status.kind === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-destructive/10 text-destructive border border-destructive/30')
          }
        >
          {status.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) { setShowConfirmDialog(false); setConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send broadcast to all students?</DialogTitle>
            <DialogDescription>
              This will message every non-banned student. The broadcast cannot be undone once started.
              Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setConfirmText(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSendAll}
              disabled={busy || confirmText.trim() !== CONFIRM_PHRASE}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send to all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
