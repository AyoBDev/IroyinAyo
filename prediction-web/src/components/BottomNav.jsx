import { TrendingUp, Crown, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getToken } from '../api.js';
import useStore from '../store.js';

const tabs = [
  { path: '/', label: 'Markets', icon: TrendingUp },
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
      padding: '8px 0 env(safe-area-inset-bottom, 8px)',
      zIndex: 200, backdropFilter: 'blur(12px)',
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '8px 16px', minHeight: '44px', minWidth: '64px',
              background: 'transparent', border: 'none',
              color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
