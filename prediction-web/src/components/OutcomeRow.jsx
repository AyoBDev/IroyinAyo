import { useState, useEffect, useRef } from 'react';

function getOutcomeStyle(label) {
  const lower = label.toLowerCase();
  if (lower === 'yes' || lower.startsWith('yes')) {
    return { color: 'var(--accent-green)', bg: 'var(--accent-green-bg)', border: 'var(--accent-green-border)', btnBg: 'var(--accent-green)', btnText: '#fff' };
  }
  if (lower === 'no' || lower.startsWith('no')) {
    return { color: 'var(--accent-red)', bg: 'var(--accent-red-bg)', border: 'var(--accent-red-border)', btnBg: 'var(--accent-red)', btnText: '#fff' };
  }
  return { color: 'var(--accent-blue)', bg: 'var(--accent-blue-bg)', border: 'var(--accent-blue-border)', btnBg: 'var(--bg-card-hover)', btnText: 'var(--text-primary)' };
}

export default function OutcomeRow({ outcome, isSelected, onSelect }) {
  const cents = Math.round(outcome.price * 100);
  const [animClass, setAnimClass] = useState('');
  const prevPrice = useRef(outcome.price);
  const style = getOutcomeStyle(outcome.label);

  useEffect(() => {
    if (outcome.prevPrice !== undefined && outcome.prevPrice !== outcome.price) {
      setAnimClass(outcome.price > outcome.prevPrice ? 'tick-up' : 'tick-down');
      const timer = setTimeout(() => setAnimClass(''), 400);
      return () => clearTimeout(timer);
    }
    prevPrice.current = outcome.price;
  }, [outcome.price, outcome.prevPrice]);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', cursor: 'pointer',
        borderRadius: 'var(--radius)', transition: 'background 0.1s',
        background: isSelected ? style.bg : 'transparent',
        borderLeft: isSelected ? `3px solid ${style.color}` : '3px solid transparent',
        margin: '2px 0',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? style.bg : 'transparent'; }}
    >
      <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>
        {outcome.label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className={animClass} style={{
          fontWeight: 700, fontSize: '14px',
          color: style.color,
          minWidth: '36px', textAlign: 'right',
        }}>
          {cents}¢
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          style={{
            padding: '5px 14px', fontSize: '12px', fontWeight: 700,
            borderRadius: '4px', color: style.btnText,
            background: style.btnBg,
            border: 'none',
            letterSpacing: '0.2px',
          }}
        >
          Predict
        </button>
      </div>
    </div>
  );
}
