import { useState } from 'react';
import { Image, Link2, Share2, Check, X } from 'lucide-react';

export default function ShareSheet({ onShareImage, onCopyLink, onShareLink, onClose, title = 'Share' }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  function handleCopyLink() {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[400px] bg-bone rounded-t-2xl border border-line border-b-0 p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-serif text-[15px] font-semibold text-ink">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-paper text-ink-muted hover:bg-paper-hover"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onShareImage}
            className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
          >
            <Image size={18} className="text-emerald" />
            <span className="text-label-sm font-medium text-ink">Share as Image</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
          >
            {copied
              ? <Check size={18} className="text-accent-green" />
              : <Link2 size={18} className="text-emerald" />
            }
            <span className="text-label-sm font-medium text-ink">
              {copied ? 'Link copied!' : 'Copy Link'}
            </span>
          </button>

          {canNativeShare && (
            <button
              onClick={onShareLink}
              className="flex items-center gap-3 w-full p-3.5 bg-paper border border-line rounded-xl text-left hover:bg-paper-hover transition-colors"
            >
              <Share2 size={18} className="text-emerald" />
              <span className="text-label-sm font-medium text-ink">Share Link</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
