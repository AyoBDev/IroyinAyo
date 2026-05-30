import { TrendingUp, Wallet } from 'lucide-react';
import useStore from '../store.js';

export default function TopBar({ onPositionsClick }) {
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0,
      background: 'var(--bg-primary)', zIndex: 100,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 24px', maxWidth: '1400px', margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={22} color="var(--accent-green)" strokeWidth={2.5} />
          <span style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.5px' }}>IroyinMarket</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              }}>
                <Wallet size={14} color="var(--text-tertiary)" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-green)' }}>
                  {user.points_balance}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>pts</span>
              </div>
              <button
                onClick={onPositionsClick}
                style={{
                  background: 'var(--accent-blue)', color: '#fff',
                  padding: '7px 16px', borderRadius: '20px', fontSize: '13px',
                  fontWeight: 600, border: 'none',
                }}
              >
                Portfolio
              </button>
            </>
          ) : (
            <button
              onClick={openAuthModal}
              style={{
                background: '#25D366', color: '#fff',
                padding: '7px 16px', borderRadius: '20px', fontSize: '13px',
                fontWeight: 600, border: 'none',
              }}
            >
              Join
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
