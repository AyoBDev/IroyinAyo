import { useState } from 'react';
import OutcomeRow from './OutcomeRow.jsx';
import BetSlip from './BetSlip.jsx';

export default function MarketCard({ market }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  if (market.status === 'resolved') {
    return (
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '1.5rem', marginBottom: '1rem', border: '1px solid var(--border)',
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{market.title}</h2>
        <div style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
          ✅ Resolved — Winner: {market.winnerLabel}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      padding: '1.5rem', marginBottom: '1rem', border: '1px solid var(--border)',
    }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{market.title}</h2>

      {market.outcomes && market.outcomes.length > 0 ? (
        <div>
          {market.outcomes.map((outcome) => (
            <div key={outcome.id}>
              <OutcomeRow
                outcome={outcome}
                isSelected={selectedOutcome === outcome.id}
                onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
              />
              {selectedOutcome === outcome.id && (
                <BetSlip
                  market={market}
                  outcome={outcome}
                  onClose={() => setSelectedOutcome(null)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>Teams coming soon...</p>
      )}
    </div>
  );
}
