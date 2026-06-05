import { useState } from 'react';
import { X, ArrowRight, Users, Copy, Check } from 'lucide-react';
import useStore from '../store.js';

function getSlipClasses(label) {
  const lower = label.toLowerCase();
  if (lower === 'yes' || lower.startsWith('yes')) {
    return { accent: 'text-accent-green', bg: 'bg-accent-green-bg', border: 'border-accent-green-border', accentBg: 'bg-accent-green' };
  }
  if (lower === 'no' || lower.startsWith('no')) {
    return { accent: 'text-accent-red', bg: 'bg-accent-red-bg', border: 'border-accent-red-border', accentBg: 'bg-accent-red' };
  }
  return { accent: 'text-emerald', bg: 'bg-accent-green-bg', border: 'border-accent-green-border', accentBg: 'bg-emerald' };
}

export default function BetSlip({ market, outcome, onClose }) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const placePrediction = useStore((s) => s.placePrediction);
  const fetchPositions = useStore((s) => s.fetchPositions);
  const user = useStore((s) => s.user);
  const cls = getSlipClasses(outcome.label);

  const amountNum = parseInt(amount, 10) || 0;
  const payout = amountNum > 0 ? Math.floor(amountNum / outcome.price) : 0;
  const profit = payout - amountNum;

  const maxBet = Math.min(user?.points_balance || 0, 1000);

  async function handleSubmit() {
    if (amountNum < 1) return;
    if (amountNum > maxBet) {
      setError(`You only have ${user?.points_balance || 0} pts available`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await placePrediction(market.id, outcome.id, amountNum);
      fetchPositions();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`p-4 bg-bone rounded-lg mt-1.5 animate-slide-up border ${cls.border}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${cls.accentBg}`} />
          <span className="text-[13px] font-semibold text-ink">
            {outcome.label}
          </span>
          <span className="text-xs text-ink-muted">
            @ {Math.round(outcome.price * 100)}¢
          </span>
        </div>
        <button onClick={onClose} className="bg-paper text-ink-muted w-6 h-6 flex items-center justify-center rounded-md">
          <X size={14} />
        </button>
      </div>

      {/* Amount input */}
      <div className="flex gap-1.5 mb-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-[13px] font-semibold">pts</span>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full py-2.5 pr-3 pl-10 bg-bone border border-line rounded-md text-ink text-[15px] font-semibold placeholder:text-ink-muted"
            autoFocus
          />
        </div>
        {[5, 10, 25, 50].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            className={`px-2.5 py-2 border rounded-md text-xs font-bold min-w-[38px] ${
              amount === String(v)
                ? `${cls.bg} ${cls.border} ${cls.accent}`
                : 'bg-paper border-line text-ink-muted'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Payout display */}
      {amountNum > 0 && (
        <div className="flex justify-between items-center py-3 px-3.5 bg-paper rounded-md mb-3 border border-line">
          <div className="text-xs text-ink-muted">Potential return</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted font-mono">{amountNum} pts</span>
            <ArrowRight size={12} className="text-ink-muted" />
            <span className={`text-[15px] font-bold font-mono ${cls.accent}`}>
              {payout} pts
            </span>
            <span className="text-[11px] font-semibold text-accent-green bg-accent-green-bg px-1.5 py-0.5 rounded">
              +{profit}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-accent-red text-xs mb-2.5 py-2.5 px-3 bg-accent-red-bg rounded-md border border-accent-red-border">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={amountNum < 1 || submitting}
        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide ${
          amountNum > 0
            ? `${cls.accentBg} text-bone`
            : 'bg-line text-ink-muted'
        } ${submitting ? 'opacity-60' : ''}`}
      >
        {submitting ? 'Confirming...' : amountNum > 0 ? `Predict ${outcome.label}` : 'Enter amount'}
      </button>

      {/* Balance hint */}
      {user && amountNum > 0 && (
        <div className={`text-center mt-2 text-[11px] font-mono ${
          amountNum > user.points_balance ? 'text-accent-red' : 'text-ink-muted'
        }`}>
          {amountNum > user.points_balance
            ? `Not enough points (you have ${user.points_balance})`
            : `Balance after: ${user.points_balance - amountNum} pts`}
        </div>
      )}

      {/* Referral prompt when low balance */}
      {user && user.points_balance < 20 && <ReferralPrompt />}
    </div>
  );
}

function ReferralPrompt() {
  const [copied, setCopied] = useState(false);
  const referralLink = 'https://wa.me/2347072356504?text=web';

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-3 py-3 px-3.5 rounded-md bg-accent-green-bg border border-accent-green-border">
      <div className="flex items-center gap-2 mb-1.5">
        <Users size={14} className="text-emerald" />
        <span className="text-xs font-bold text-emerald">
          Low on points? Refer friends!
        </span>
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed mb-2">
        Share IroyinMarket with friends. When they join and start predicting, you both earn bonus points.
      </p>
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 w-full py-2 px-3 rounded-md bg-paper border border-line text-[11px] font-semibold ${
          copied ? 'text-accent-green' : 'text-ink-muted'
        }`}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Link copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
