import { Activity, Zap } from 'lucide-react';
import useStore from '../store.js';

export default function ActivityFeed() {
  const feed = useStore((s) => s.feed);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--accent-green)',
          animation: 'pulse 2s infinite',
          boxShadow: '0 0 6px var(--accent-green)',
        }} />
        <Activity size={13} color="var(--text-secondary)" />
        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Live</h3>
      </div>

      <div style={{ maxHeight: '350px', overflow: 'auto' }}>
        {feed.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <Zap size={20} color="var(--text-tertiary)" style={{ marginBottom: '8px' }} />
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Waiting for predictions...
            </p>
          </div>
        ) : (
          <div style={{ padding: '6px' }}>
            {feed.map((item, i) => (
              <div
                key={`${item.timestamp}-${i}`}
                style={{
                  fontSize: '12px', color: 'var(--text-secondary)',
                  padding: '9px 10px', borderRadius: 'var(--radius)',
                  animation: i === 0 ? 'fadeIn 0.3s ease' : undefined,
                  margin: '2px 0',
                  background: i === 0 ? 'var(--bg-card-hover)' : 'transparent',
                }}
              >
                <span style={{ color: 'var(--accent-green)', marginRight: '6px', fontSize: '8px' }}>●</span>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.amount} pts</strong>
                {' on '}
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.outcomeLabel}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
