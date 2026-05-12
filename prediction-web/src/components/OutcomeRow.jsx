import { useState, useEffect, useRef } from 'react';

export default function OutcomeRow({ outcome, isSelected, onSelect }) {
  const cents = Math.round(outcome.price * 100);
  const [animClass, setAnimClass] = useState('');
  const prevPrice = useRef(outcome.price);

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
        padding: '0.85rem 1rem', cursor: 'pointer', position: 'relative',
        borderRadius: '8px', transition: 'background 0.15s',
        background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${cents}%`, background: 'var(--accent-blue)',
        opacity: 0.08, borderRadius: '8px', transition: 'width 0.4s ease',
      }} />
      <span style={{ fontWeight: 500, fontSize: '0.95rem', zIndex: 1 }}>{outcome.label}</span>
      <span className={animClass} style={{ fontWeight: 700, fontSize: '1.1rem', zIndex: 1 }}>
        {cents}¢
      </span>
    </div>
  );
}
