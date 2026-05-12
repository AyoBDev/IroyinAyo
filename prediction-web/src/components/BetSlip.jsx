import { useState } from 'react';
import useStore from '../store.js';

export default function BetSlip({ market, outcome, onClose }) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const placeBet = useStore((s) => s.placeBet);
  const fetchPositions = useStore((s) => s.fetchPositions);

  const amountNum = parseInt(amount, 10) || 0;
  const shares = amountNum > 0 ? (amountNum / outcome.price).toFixed(1) : '0';
  const payout = amountNum > 0 ? Math.floor(amountNum / outcome.price) : 0;

  async function handleSubmit() {
    if (amountNum < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      await placeBet(market.id, outcome.id, amountNum);
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
      padding: '1rem', background: '#161b2e', borderRadius: '8px',
      marginTop: '0.5rem', animation: 'slideDown 0.2s ease',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Bet on <strong style={{ color: 'var(--text-primary)' }}>{outcome.label}</strong>
        </span>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1, padding: '0.6rem', background: 'var(--bg-primary)',
            border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--text-primary)', fontSize: '1rem',
          }}
        />
        {[10, 25, 50].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            style={{
              padding: '0.6rem 0.8rem', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.85rem',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {amountNum > 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          ~{shares} shares → <span style={{ color: 'var(--accent-green)' }}>{payout} pts</span> if they win
        </div>
      )}

      {error && <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={amountNum < 1 || submitting}
        style={{
          width: '100%', padding: '0.75rem', borderRadius: '8px',
          background: amountNum > 0 ? 'var(--accent-blue)' : 'var(--border)',
          color: 'white', fontWeight: 600, fontSize: '0.95rem',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Placing...' : `Bet ${amountNum || 0} pts`}
      </button>
    </div>
  );
}
