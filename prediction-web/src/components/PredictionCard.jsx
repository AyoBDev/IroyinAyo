import { forwardRef } from 'react';

const PredictionCard = forwardRef(function PredictionCard({
  marketTitle,
  outcomeLabel,
  probability,
  amount,
  potentialPayout,
  username,
  timestamp,
}, ref) {
  const returnMultiplier = amount > 0 ? (potentialPayout / amount).toFixed(1) : '0.0';
  const percentDisplay = Math.round(probability * 100);
  const dateStr = new Date(timestamp).toLocaleDateString('en-NG', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      ref={ref}
      className="w-[360px] max-w-full bg-bone rounded-2xl border border-line p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <span className="font-serif text-[15px] text-ink italic font-semibold">
          IroyinMarket
        </span>
        <span className="font-mono text-mono-label text-ink-muted">
          {dateStr}
        </span>
      </div>

      {/* Declaration */}
      <div className="text-center mb-5">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-ink-muted mb-2">
          I'M CALLING IT
        </div>
        <div className="font-serif text-[28px] font-bold text-emerald mb-1">
          {outcomeLabel}
        </div>
        <div className="font-serif text-[15px] text-ink leading-snug max-w-[240px] mx-auto line-clamp-2">
          {marketTitle}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-ink-muted">
            Confidence
          </span>
          <span className="font-mono text-[12px] font-semibold text-accent-green">
            {percentDisplay}%
          </span>
        </div>
        <div className="h-1.5 bg-paper rounded-full border border-line overflow-hidden">
          <div
            className="h-full bg-accent-green rounded-full transition-all"
            style={{ width: `${percentDisplay}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center p-3 bg-paper rounded-lg">
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-ink">{amount}</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">Staked</div>
        </div>
        <div className="w-px h-8 bg-line" />
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-accent-green">{potentialPayout}</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">To Win</div>
        </div>
        <div className="w-px h-8 bg-line" />
        <div className="text-center flex-1">
          <div className="font-mono text-[16px] font-semibold text-ink">{returnMultiplier}x</div>
          <div className="font-mono text-[10px] uppercase text-ink-muted">Return</div>
        </div>
      </div>

      {/* Username */}
      <div className="text-center mt-3">
        <span className="font-mono text-[11px] text-ink-muted">@{username}</span>
      </div>
    </div>
  );
});

export default PredictionCard;
