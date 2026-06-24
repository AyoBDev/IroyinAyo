import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp } from 'lucide-react';
import { captureFile, shareFile } from '../shareImage.js';
import ShareSheet from './ShareSheet.jsx';

const MarketShareCard = forwardRef(function MarketShareCard({ market }, cardRef) {
  const outcomes = market.outcomes || [];
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);
  const topOutcome = sorted[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;
  const isResolved = market.status === 'resolved';

  return (
    <div
      ref={cardRef}
      className="w-[360px] max-w-full bg-bone rounded-2xl border border-line p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="font-serif text-[15px] text-ink italic font-semibold">
          IroyinMarket
        </span>
        {market.category && (
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-ink-muted bg-paper px-2 py-0.5 rounded border border-line">
            {market.category}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-serif text-[20px] font-bold text-ink leading-tight mb-4 line-clamp-2">
        {market.title}
      </h3>

      {/* Outcomes */}
      {isResolved ? (
        <div className="flex items-center gap-2.5 p-3 bg-accent-green-bg rounded-lg border border-accent-green-border mb-3">
          <span className="text-[11px] text-ink-muted">Winner:</span>
          <span className="text-[15px] font-bold text-accent-green">{market.winnerLabel}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {sorted.slice(0, 4).map((o) => {
            const pct = Math.round(o.price * 100);
            return (
              <div key={o.id} className="flex items-center gap-2.5">
                <div className="flex-1 h-7 bg-paper rounded overflow-hidden border border-line relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-green-bg rounded"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative px-2.5 text-[12px] font-medium text-ink leading-7 truncate block">
                    {o.label}
                  </span>
                </div>
                <span className="font-mono text-[13px] font-semibold text-ink w-10 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-line">
        <div className="flex items-center gap-1 text-ink-muted">
          <TrendingUp size={12} />
          <span className="font-mono text-[11px]">{outcomes.length} outcomes</span>
        </div>
        <span className="font-mono text-[11px] text-ink-muted">
          {market.participant_count || 0} predictors
        </span>
      </div>
    </div>
  );
});

export default function MarketShareModal({ market, onClose }) {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareImageFile, setShareImageFile] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      captureFile(cardRef.current, { fileName: 'market.png' })
        .then((file) => { if (!cancelled) setShareImageFile(file); })
        .catch((err) => console.warn('market card capture failed:', err));
    });
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, []);

  const outcomes = market.outcomes || [];
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);
  const topOutcome = sorted[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;
  const isResolved = market.status === 'resolved';

  const shareUrl = `${window.location.origin}/market/${market.id}`;
  const shareText = isResolved
    ? `${market.winnerLabel || 'Result'} won "${market.title}" on IroyinMarket!\n\nPredict here: ${shareUrl}`
    : `${topOutcome?.label || 'Leading'} leads at ${topPercent}% — "${market.title}" on IroyinMarket\n\nPredict here: ${shareUrl}`;

  const handleShareImage = useCallback(() => {
    shareFile({
      file: shareImageFile,
      text: shareText,
      title: market.title,
    });
    setShowShareSheet(false);
  }, [shareImageFile, shareText, market.title]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: market.title,
        text: shareText,
        url: shareUrl,
      }).catch(() => {});
    }
    setShowShareSheet(false);
  }, [market.title, shareText, shareUrl]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative flex flex-col items-center animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-paper border border-line text-ink-muted hover:bg-paper-hover z-10"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* The card */}
        <MarketShareCard market={market} ref={cardRef} />

        {/* Action buttons */}
        <div className="w-full max-w-[360px] mt-4 flex flex-col gap-2.5">
          <button
            onClick={() => setShowShareSheet(true)}
            className="w-full py-3.5 bg-emerald text-bone rounded-xl text-label-sm font-semibold hover:bg-emerald-deep transition-colors"
          >
            Share
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-transparent text-ink-muted rounded-xl text-label-sm font-medium hover:text-ink transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Share sheet */}
      {showShareSheet && (
        <ShareSheet
          title="Share market"
          imageReady={!!shareImageFile}
          onShareImage={handleShareImage}
          onCopyLink={handleCopyLink}
          onShareLink={handleShareLink}
          onClose={() => setShowShareSheet(false)}
        />
      )}
    </div>,
    document.body
  );
}
