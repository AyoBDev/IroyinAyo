import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import html2canvas from 'html2canvas';
import PredictionCard from './PredictionCard.jsx';
import ShareSheet from './ShareSheet.jsx';

export default function PredictionConfirmation({ data, onClose }) {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shareUrl = `${window.location.origin}/share/prediction/${data.positionId}`;

  const handleShareImage = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#fbf7ef',
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'prediction.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `I'm calling it: ${data.outcomeLabel}`,
            text: `${data.marketTitle} — ${Math.round(data.probability * 100)}% confidence`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'prediction.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
    setShowShareSheet(false);
  }, [data]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareLink = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: `I'm calling it: ${data.outcomeLabel}`,
        text: `${data.marketTitle} — ${Math.round(data.probability * 100)}% confidence`,
        url: shareUrl,
      });
    }
    setShowShareSheet(false);
  }, [data, shareUrl]);

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
        <PredictionCard
          ref={cardRef}
          marketTitle={data.marketTitle}
          outcomeLabel={data.outcomeLabel}
          probability={data.probability}
          amount={data.amount}
          potentialPayout={data.potentialPayout}
          username={data.username}
          timestamp={data.timestamp}
        />

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
