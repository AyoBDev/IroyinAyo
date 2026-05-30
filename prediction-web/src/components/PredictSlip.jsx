import { useState } from 'react';
import { X, ArrowRight, Users, Copy, Check } from 'lucide-react';
import useStore from '../store.js';
import { getToken } from '../api.js';

function getSlipStyle(label) {
  const lower = label.toLowerCase();
  if (lower === 'yes' || lower.startsWith('yes')) {
    return { accent: 'var(--accent-green)', bg: 'var(--accent-green-bg)', border: 'var(--accent-green-border)' };
  }
  if (lower === 'no' || lower.startsWith('no')) {
    return { accent: 'var(--accent-red)', bg: 'var(--accent-red-bg)', border: 'var(--accent-red-border)' };
  }
  return { accent: 'var(--accent-blue)', bg: 'var(--accent-blue-bg)', border: 'var(--accent-blue-border)' };
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
  const style = getSlipStyle(outcome.label);

  const amountNum = parseInt(amount, 10) || 0;
  const payout = amountNum > 0 ? Math.floor(amountNum / outcome.price) : 0;
  const profit = payout - amountNum;

  async function handleSubmit() {
    if (amountNum < 1) return;
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
    <div style={{
      padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
      marginTop: '6px', animation: 'slideUp 0.15s ease',
      border: `1px solid ${style.border}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', background: style.accent,
          }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {outcome.label}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            @ {Math.round(outcome.price * 100)}¢
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'var(--bg-card)', color: 'var(--text-tertiary)',
          width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius)',
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Amount input */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 600 }}>pts</span>
          <input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: '100%', padding: '11px 12px 11px 40px', background: 'var(--bg-input)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600,
            }}
            autoFocus
          />
        </div>
        {[5, 10, 25, 50].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            style={{
              padding: '8px 10px',
              background: amount === String(v) ? style.bg : 'var(--bg-card)',
              border: `1px solid ${amount === String(v) ? style.border : 'var(--border)'}`,
              borderRadius: 'var(--radius)', color: amount === String(v) ? style.accent : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 700, minWidth: '38px',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Payout display */}
      {amountNum > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', background: 'var(--bg-card)',
          borderRadius: 'var(--radius)', marginBottom: '12px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Potential return</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{amountNum} pts</span>
            <ArrowRight size={12} color="var(--text-tertiary)" />
            <span style={{ fontSize: '15px', fontWeight: 800, color: style.accent }}>
              {payout} pts
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--accent-green)',
              background: 'var(--accent-green-bg)', padding: '2px 6px', borderRadius: '4px',
            }}>
              +{profit}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          color: 'var(--accent-red)', fontSize: '12px', marginBottom: '10px',
          padding: '10px 12px', background: 'var(--accent-red-bg)', borderRadius: 'var(--radius)',
          border: '1px solid var(--accent-red-border)',
        }}>
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={isAuthenticated ? handleSubmit : openAuthModal}
        disabled={isAuthenticated && (amountNum < 1 || submitting)}
        style={{
          width: '100%', padding: '13px', borderRadius: 'var(--radius-lg)',
          background: !isAuthenticated ? 'var(--primary)' : amountNum > 0 ? style.accent : 'var(--border)',
          color: !isAuthenticated ? '#fff' : amountNum > 0 ? '#fff' : 'var(--text-tertiary)',
          fontWeight: 700, fontSize: '14px',
          opacity: submitting ? 0.6 : 1,
          letterSpacing: '0.2px',
        }}
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
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Balance after: {user.points_balance - amountNum} pts
        </div>
      )}

      {/* Referral prompt when low balance */}
      {isAuthenticated && user && user.points_balance < 20 && <ReferralPrompt />}
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
    <div style={{
      marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--radius)',
      background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Users size={14} color="var(--accent-blue)" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-blue)' }}>
          Low on points? Refer friends!
        </span>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
        Share IroyinMarket with friends. When they join and start predicting, you both earn bonus points.
      </p>
      <button
        onClick={handleCopy}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
          padding: '8px 12px', borderRadius: 'var(--radius)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
          fontSize: '11px', fontWeight: 600,
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Link copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
