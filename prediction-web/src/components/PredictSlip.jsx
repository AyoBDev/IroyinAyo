import { useState } from 'react';
import { X, ArrowRight, Users, Copy, Check } from 'lucide-react';
import useStore from '../store.js';
import { getToken } from '../api.js';
import PredictionConfirmation from './PredictionConfirmation.jsx';

function getSlipClasses(label) {
  const lower = label.toLowerCase();
  if (lower === 'yes' || lower.startsWith('yes')) {
    return {
      accentText: 'text-accent-green',
      dotBg: 'bg-accent-green',
      amountActive: 'bg-accent-green-bg border-accent-green-border text-accent-green',
      submitActive: 'bg-accent-green text-white hover:opacity-90',
    };
  }
  if (lower === 'no' || lower.startsWith('no')) {
    return {
      accentText: 'text-accent-red',
      dotBg: 'bg-accent-red',
      amountActive: 'bg-accent-red-bg border-accent-red-border text-accent-red',
      submitActive: 'bg-accent-red text-white hover:opacity-90',
    };
  }
  return {
    accentText: 'text-emerald',
    dotBg: 'bg-emerald',
    amountActive: 'bg-accent-violet-bg border-accent-violet-border text-accent-violet',
    submitActive: 'bg-emerald text-bone hover:bg-emerald-deep',
  };
}

export default function PredictSlip({ market, outcome, onClose }) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const placePrediction = useStore((s) => s.placePrediction);
  const fetchPositions = useStore((s) => s.fetchPositions);
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);
  const isAuthenticated = !!getToken();
  const classes = getSlipClasses(outcome.label);
  const [confirmationData, setConfirmationData] = useState(null);

  const amountNum = parseInt(amount, 10) || 0;
  const payout = amountNum > 0 ? Math.floor(amountNum / outcome.price) : 0;
  const profit = payout - amountNum;

  async function handleSubmit() {
    if (amountNum < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await placePrediction(market.id, outcome.id, amountNum);
      fetchPositions();
      const position = result?.position;
      setConfirmationData({
        positionId: position?.id || 'unknown',
        marketId: market.id,
        marketTitle: market.title,
        outcomeLabel: outcome.label,
        probability: outcome.price,
        amount: amountNum,
        potentialPayout: payout,
        username: user?.username || user?.phone || 'user',
        timestamp: position?.created_at || new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const submitBtnClasses = [
    'w-full py-3 rounded-xl font-medium text-body-sm transition-colors',
    submitting ? 'opacity-60' : '',
    !isAuthenticated
      ? 'bg-emerald text-bone hover:bg-emerald-deep'
      : amountNum > 0
        ? classes.submitActive
        : 'bg-line text-ink-muted',
  ].join(' ');

  return (
    <div className="p-4 bg-bone rounded-lg mt-1.5 animate-slide-up border border-line">
      {/* Header */}
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${classes.dotBg}`} />
          <span className="text-label-sm font-semibold text-ink">
            {outcome.label}
          </span>
          <span className="text-[12px] text-ink-muted">
            @ {Math.round(outcome.price * 100)}¢
          </span>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md bg-paper text-ink-muted hover:bg-paper-hover transition-colors">
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
            className="w-full py-2.5 pl-10 pr-3 bg-bone border border-line rounded-md text-ink text-label font-medium placeholder:text-ink-muted"
            autoFocus
          />
        </div>
        {[5, 10, 25, 50].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            className={`px-2.5 py-2 text-[12px] font-bold rounded-md min-w-[38px] border ${
              amount === String(v)
                ? classes.amountActive
                : 'bg-paper border-line text-ink-muted hover:bg-paper-hover'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Payout display */}
      {amountNum > 0 && (
        <div className="flex justify-between items-center p-3 bg-paper rounded-md mb-3 border border-line">
          <div className="text-[12px] text-ink-muted">Potential return</div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-muted">{amountNum} pts</span>
            <ArrowRight size={12} className="text-ink-muted" />
            <span className={`text-[15px] font-extrabold ${classes.accentText}`}>
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
        <div className="text-accent-red text-[12px] mb-2.5 px-3 py-2.5 bg-accent-red-bg rounded-md border border-accent-red-border">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={isAuthenticated ? handleSubmit : openAuthModal}
        disabled={isAuthenticated && (amountNum < 1 || submitting)}
        className={submitBtnClasses}
      >
        {!isAuthenticated
          ? 'Sign up to predict'
          : submitting
            ? 'Confirming...'
            : amountNum > 0
              ? `Predict ${outcome.label}`
              : 'Enter amount'}
      </button>

      {/* Balance hint */}
      {isAuthenticated && user && amountNum > 0 && (
        <div className="text-center mt-2 text-[11px] text-ink-muted">
          Balance after: {user.points_balance - amountNum} pts
        </div>
      )}

      {/* Referral prompt when low balance */}
      {isAuthenticated && user && user.points_balance < 20 && <ReferralPrompt />}

      {confirmationData && (
        <PredictionConfirmation
          data={confirmationData}
          onClose={() => { setConfirmationData(null); onClose(); }}
        />
      )}
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
    <div className="mt-3 p-3 rounded-md bg-accent-violet-bg border border-accent-violet-border">
      <div className="flex items-center gap-2 mb-1.5">
        <Users size={14} className="text-accent-violet" />
        <span className="text-[12px] font-bold text-accent-violet">
          Low on points? Refer friends!
        </span>
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed mb-2">
        Share IroyinMarket with friends. When they join and start predicting, you both earn bonus points.
      </p>
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 w-full px-3 py-2 rounded-md bg-paper border border-line text-[11px] font-semibold ${
          copied ? 'text-accent-green' : 'text-ink-muted'
        }`}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Link copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
