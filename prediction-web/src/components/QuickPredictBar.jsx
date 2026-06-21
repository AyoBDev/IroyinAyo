import { useState } from 'react';
import { computeDefaultStake, STAKE_FLOOR } from '../utils/defaultStake';

export default function QuickPredictBar({ market, outcomes, recentStakes, balance, onPredict }) {
  const [stake, setStake] = useState(() => computeDefaultStake({ recentStakes, balance }));
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);

  const cappedAtMax = stake === Math.min(1000, Math.floor(balance * 0.10 / 50) * 50);
  const canSubmit = selectedOutcomeId && stake >= STAKE_FLOOR && stake <= balance;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line p-4 z-40">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {outcomes.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedOutcomeId(o.id)}
              className={`h-16 rounded-xl font-serif text-2xl border ${selectedOutcomeId === o.id ? 'border-emerald bg-emerald text-bone' : 'border-line bg-paper text-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setStake((s) => Math.max(STAKE_FLOOR, s - 50))} className="h-11 w-11 rounded-lg border border-line">−</button>
          <div className="flex-1 text-center font-mono">
            <div className="text-xl">{stake} pts</div>
            {cappedAtMax && <span className="text-xs text-ochre">max</span>}
          </div>
          <button onClick={() => setStake((s) => Math.min(balance, s + 50))} className="h-11 w-11 rounded-lg border border-line">+</button>
        </div>

        <button
          disabled={!canSubmit}
          onClick={() => onPredict(selectedOutcomeId, stake)}
          className="h-14 rounded-xl bg-emerald text-bone disabled:opacity-50 font-sans"
        >
          Predict
        </button>
      </div>
    </div>
  );
}
