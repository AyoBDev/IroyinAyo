import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { shareWithImage } from '../shareImage.js';
import ProfileCard from './ProfileCard.jsx';
import ShareSheet from './ShareSheet.jsx';
import { track } from '../utils/telemetry.js';

export default function ProfileShareModal({ data, onClose }) {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shareUrl = data.referralCode
    ? `${window.location.origin}?ref=${data.referralCode}`
    : window.location.origin;
  const firstName = (data.name || '').split(' ')[0] || data.name;
  const shareText = data.accuracy == null
    ? `${firstName} is a new caller on IroyinMarket.\n\n${shareUrl}`
    : `${firstName} is ${Math.round(data.accuracy)}% accurate on IroyinMarket.\n\n${shareUrl}`;

  const handleShareImage = useCallback(async () => {
    if (!cardRef.current) return;
    track('profile_share_captured', { target_user_id: data.referralCode || 'unknown' });
    await shareWithImage(cardRef.current, { text: shareText, fileName: 'profile.png' });
    setShowShareSheet(false);
  }, [shareText, data.referralCode]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareLink = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${data.name} on IroyinMarket`,
        text: shareText,
        url: shareUrl,
      });
    }
    setShowShareSheet(false);
  }, [data, shareText, shareUrl]);

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
        <ProfileCard
          ref={cardRef}
          name={data.name}
          title={data.title}
          accuracy={data.accuracy}
          streak={data.streak}
          totalPredictions={data.totalPredictions}
          winRate={data.winRate}
          pointsBalance={data.pointsBalance}
          referralCode={data.referralCode}
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
          title="Share profile"
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
