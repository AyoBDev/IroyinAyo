import { TrendingUp, Crown, User, Wallet, ChartLine } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getToken } from '../api.js';
import useStore from '../store.js';

const tabs = [
  { path: '/', label: 'Markets', icon: TrendingUp },
  { path: '/portfolio', label: 'Portfolio', icon: ChartLine, requiresAuth: true },
  { path: '/leaderboard', label: 'Leaderboard', icon: Crown },
  { path: '/profile', label: 'Profile', icon: User, requiresAuth: true },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const openAuthModal = useStore((s) => s.openAuthModal);

  return (
    <nav className="mobile-only" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 16px calc(env(safe-area-inset-bottom, 8px) + 8px)',
      zIndex: 200,
      borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => {
              if (tab.requiresAuth && !getToken()) {
                openAuthModal();
              } else {
                navigate(tab.path);
              }
            }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              padding: isActive ? '6px 20px' : '6px 16px',
              minHeight: '44px',
              background: isActive ? 'var(--primary-bg)' : 'transparent',
              borderRadius: 'var(--radius-full)',
              color: isActive ? 'var(--primary)' : 'var(--text-tertiary)',
              border: 'none',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
