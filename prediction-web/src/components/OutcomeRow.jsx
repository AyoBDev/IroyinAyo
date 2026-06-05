import { useState, useEffect, useRef } from 'react';

function getOutcomeClasses(label) {
  const lower = label.toLowerCase();
  if (lower === 'yes' || lower.startsWith('yes')) {
    return {
      colorClass: 'text-accent-green',
      bgClass: 'bg-accent-green-bg',
      borderClass: 'border-l-accent-green',
      btnClass: 'bg-accent-green text-white',
    };
  }
  if (lower === 'no' || lower.startsWith('no')) {
    return {
      colorClass: 'text-accent-red',
      bgClass: 'bg-accent-red-bg',
      borderClass: 'border-l-accent-red',
      btnClass: 'bg-accent-red text-white',
    };
  }
  return {
    colorClass: 'text-emerald',
    bgClass: 'bg-accent-violet-bg',
    borderClass: 'border-l-emerald',
    btnClass: 'bg-paper-hover text-ink',
  };
}

export default function OutcomeRow({ outcome, isSelected, onSelect }) {
  const cents = Math.round(outcome.price * 100);
  const [animClass, setAnimClass] = useState('');
  const prevPrice = useRef(outcome.price);
  const classes = getOutcomeClasses(outcome.label);

  useEffect(() => {
    if (outcome.prevPrice !== undefined && outcome.prevPrice !== outcome.price) {
      setAnimClass(outcome.price > outcome.prevPrice ? 'animate-tick-up' : 'animate-tick-down');
      const timer = setTimeout(() => setAnimClass(''), 400);
      return () => clearTimeout(timer);
    }
    prevPrice.current = outcome.price;
  }, [outcome.price, outcome.prevPrice]);

  const containerClasses = [
    'flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-md transition-colors my-0.5 border-l-[3px]',
    isSelected
      ? `${classes.bgClass} ${classes.borderClass}`
      : 'border-l-transparent hover:bg-paper-hover',
  ].join(' ');

  return (
    <div onClick={onSelect} className={containerClasses}>
      <span className="font-medium text-label-sm text-ink flex-1">
        {outcome.label}
      </span>

      <div className="flex items-center gap-2.5">
        <span className={`font-mono text-mono-data font-normal min-w-[36px] text-right ${classes.colorClass} ${animClass}`}>
          {cents}¢
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`px-3.5 py-1 text-[12px] font-medium rounded-md border-none tracking-wide ${classes.btnClass}`}
        >
          Predict
        </button>
      </div>
    </div>
  );
}
