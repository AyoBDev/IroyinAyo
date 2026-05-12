import { TrendingUp, Trophy, Medal, Flame, CircleDot, Wallet } from 'lucide-react';
import useStore from '../store.js';

export default function TopBar({ onPositionsClick, activeTab, onTabChange }) {
  const user = useStore((s) => s.user);

  const tabs = [
    { id: 'all', label: 'All', icon: Flame },
    { id: '1st', label: '1st Place', icon: Trophy },
    { id: '2nd', label: '2nd Place', icon: Medal },
    { id: '3rd', label: '3rd Place', icon: Medal },
    { id: 'football', label: 'Football', icon: CircleDot },
  ];

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
          {user && (
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
          )}
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
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '2px', padding: '0 24px',
        maxWidth: '1400px', margin: '0 auto',
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '11px 16px', fontSize: '13px', fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
