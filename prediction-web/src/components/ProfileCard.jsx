import { forwardRef } from 'react';

const ProfileCard = forwardRef(function ProfileCard({
  name,
  title,
  accuracy,
  streak,
  totalPredictions,
  winRate,
  pointsBalance,
  referralCode,
}, ref) {
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
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-ink-muted bg-paper px-2 py-0.5 rounded border border-line">
          {title}
        </span>
      </div>

      {/* Name + avatar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-full bg-accent-green-bg border-2 border-emerald/30 flex items-center justify-center shrink-0">
          <span className="text-xl font-extrabold text-emerald">
            {name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <div>
          <div className="font-serif text-[22px] font-bold text-ink leading-tight">
            {name}
          </div>
          <div className="font-mono text-[11px] text-ink-muted mt-0.5">
            Prediction Market Player
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-paper rounded-lg p-3 text-center">
          <div className="font-mono text-[18px] font-bold text-accent-green">{accuracy}%</div>
          <div className="font-mono text-[9px] uppercase text-ink-muted tracking-[1px]">Accuracy</div>
        </div>
        <div className="bg-paper rounded-lg p-3 text-center">
          <div className="font-mono text-[18px] font-bold text-ink">{winRate}%</div>
          <div className="font-mono text-[9px] uppercase text-ink-muted tracking-[1px]">Win Rate</div>
        </div>
        <div className="bg-paper rounded-lg p-3 text-center">
          <div className="font-mono text-[18px] font-bold text-ink">{totalPredictions}</div>
          <div className="font-mono text-[9px] uppercase text-ink-muted tracking-[1px]">Predictions</div>
        </div>
        <div className="bg-paper rounded-lg p-3 text-center">
          <div className="font-mono text-[18px] font-bold text-accent-green">{streak}</div>
          <div className="font-mono text-[9px] uppercase text-ink-muted tracking-[1px]">Week Streak</div>
        </div>
      </div>

      {/* Balance */}
      <div className="flex justify-between items-center p-3 bg-paper rounded-lg mb-3">
        <span className="font-mono text-[10px] uppercase text-ink-muted tracking-[1px]">Balance</span>
        <span className="font-mono text-[16px] font-bold text-ink">{pointsBalance} pts</span>
      </div>

      {/* Referral CTA */}
      {referralCode && (
        <div className="text-center mt-1">
          <div className="font-mono text-[10px] uppercase text-ink-muted tracking-[1px] mb-1">Join with code</div>
          <div className="font-mono text-[16px] font-bold text-emerald tracking-wider">{referralCode}</div>
        </div>
      )}
    </div>
  );
});

export default ProfileCard;
