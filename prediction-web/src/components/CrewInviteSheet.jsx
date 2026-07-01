import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, RotateCcw, Share2 } from 'lucide-react';
import { apiFetch } from '../api.js';

export default function CrewInviteSheet({ crewId, inviteToken: initialToken, isCreator, onClose }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const inviteUrl = `${window.location.origin}/invite/${token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    const text = `Join my crew on IroyinMarket — we predict football together. ${inviteUrl}`;
    if (navigator.share) {
      try { await navigator.share({ text, url: inviteUrl }); } catch {}
    } else {
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, '_blank');
    }
  }

  async function handleRotate() {
    if (!confirm('This invalidates the current invite link. Continue?')) return;
    setRotating(true);
    try {
      const { newToken } = await apiFetch(`/api/crews/${crewId}/rotate-invite`, { method: 'POST' });
      setToken(newToken);
    } finally {
      setRotating(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="bg-paper w-full max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-section">Invite friends</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bone flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-ink-muted mb-4">Anyone with this link can join your crew (up to 15 members).</p>
        <div className="bg-bone border border-line rounded-lg px-3 py-2.5 mb-3 text-[12px] break-all">{inviteUrl}</div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-paper border border-line">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald text-white">
            <Share2 size={14} /> Share
          </button>
        </div>
        {isCreator && (
          <button onClick={handleRotate} disabled={rotating} className="w-full mt-3 py-2.5 rounded-lg bg-transparent border border-line text-ink-muted text-[12px] flex items-center justify-center gap-1.5">
            <RotateCcw size={12} /> {rotating ? 'Rotating…' : 'Regenerate link'}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
