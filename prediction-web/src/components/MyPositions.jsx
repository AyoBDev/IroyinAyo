import { X, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import useStore from '../store.js';
import { getToken } from '../api.js';

export default function MyPositions({ onClose }) {
  if (!getToken()) return null;

  const positions = useStore((s) => s.positions);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '60px 16px',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)', width: '100%', maxWidth: '480px',
          maxHeight: '75vh', overflow: 'auto', animation: 'slideUp 0.2s ease',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} color="var(--accent-green)" />
            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Portfolio</h3>
            {positions.length > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)',
                background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px',
              }}>
                {positions.length}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius)',
          }}>
            <X size={14} />
          </button>
        </div>

        {positions.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <TrendingUp size={28} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
              No predictions yet. Pick a market to get started.
            </p>
          </div>
        ) : (
          <div style={{ padding: '8px' }}>
            {positions.map((pos) => {
              const isWin = pos.payout > 0;
              return (
                <div key={pos.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)', margin: '4px 0',
                  background: 'var(--bg-secondary)',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px', fontWeight: 500 }}>
                    {pos.market_title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{pos.outcome_label}</span>
                    <div style={{ textAlign: 'right' }}>
                      {pos.market_status === 'resolved' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isWin ? <ArrowUpRight size={14} color="var(--accent-green)" /> : <ArrowDownRight size={14} color="var(--accent-red)" />}
                          <span style={{
                            fontSize: '13px', fontWeight: 700,
                            color: isWin ? 'var(--accent-green)' : 'var(--accent-red)',
                          }}>
                            {isWin ? `+${pos.payout} pts` : 'Lost'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>
                            {Number(pos.shares).toFixed(1)} shares
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {Number(pos.cost_basis || pos.amount || 0).toFixed(0)} pts invested
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
