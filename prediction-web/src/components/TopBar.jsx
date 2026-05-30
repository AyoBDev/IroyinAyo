import { TrendingUp, Wallet, Search } from 'lucide-react';
import useStore from '../store.js';

export default function TopBar({ onPositionsClick }) {
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 100, height: '60px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 16px',
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <TrendingUp size={22} color="var(--primary)" strokeWidth={2.5} />
        <h1 style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px', color: 'var(--primary)' }}>
          IroyinMarket
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {user ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface-container)', border: '1px solid var(--border)',
            }}>
              <Wallet size={14} color="var(--text-tertiary)" />
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}>
                {user.points_balance}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>pts</span>
            </div>
            <button
              onClick={onPositionsClick}
              style={{
                background: 'var(--primary)', color: '#fff',
                padding: '6px 16px', borderRadius: 'var(--radius-full)',
                fontSize: '12px', fontWeight: 600,
              }}
            >
              Portfolio
            </button>
          </>
        ) : (
          <button
            onClick={openAuthModal}
            style={{
              background: 'var(--primary)', color: '#fff',
              padding: '6px 16px', borderRadius: 'var(--radius-full)',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            Join
          </button>
        )}
      </div>
    </header>
  );
}
