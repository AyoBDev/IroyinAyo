import { useState, useEffect } from 'react';
import { Eye, TrendingUp } from 'lucide-react';
import { apiFetch } from '../api.js';

export default function SharpMoney() {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    apiFetch('/api/multi-markets/sharp-money')
      .then(setPicks)
      .catch(() => {});
  }, []);

  if (picks.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <Eye size={13} color="var(--accent-yellow)" />
        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
          Sharp Money
        </h3>
      </div>

      <div style={{ maxHeight: '300px', overflow: 'auto', padding: '6px' }}>
        {picks.map((pick) => (
          <div key={pick.id} style={{
            padding: '10px 12px', borderRadius: 'var(--radius)',
            margin: '2px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'var(--accent-yellow-bg)', border: '1px solid var(--accent-yellow-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: 'var(--accent-yellow)',
              }}>
                {pick.student_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {pick.student_name}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--accent-yellow)', fontWeight: 600, marginLeft: 'auto' }}>
                {pick.amount} pts
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '24px' }}>
              <TrendingUp size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{pick.outcome_label}</span>
              <span style={{ color: 'var(--text-tertiary)' }}> in </span>
              <span style={{ color: 'var(--text-secondary)' }}>{pick.market_title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
