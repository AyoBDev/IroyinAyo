import { TrendingUp, Crown, User, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../store.js';

const tabs = [
  { path: '/', label: 'Markets', icon: TrendingUp },
  { path: '/circles', label: 'Circles', icon: Users, requiresAuth: true },
  { path: '/leaderboard', label: 'Leaderboard', icon: Crown },
  { path: '/profile', label: 'Profile', icon: User, requiresAuth: true },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);

  return (
    <nav className="mobile-only fixed bottom-0 left-0 right-0 bg-paper/90 backdrop-blur-md border-t border-line flex justify-around items-center px-4 pb-[calc(env(safe-area-inset-bottom,8px)+8px)] pt-2 z-[200]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            data-tutorial={tab.path === '/leaderboard' ? 'leaderboard-tab' : undefined}
            onClick={() => {
              if (tab.requiresAuth && !user) {
                openAuthModal();
              } else {
                navigate(tab.path);
              }
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 min-h-[44px] rounded-full transition-colors ${
              isActive
                ? 'bg-accent-green-bg text-emerald'
                : 'text-ink-muted hover:text-ink-deep'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[11px] ${isActive ? 'font-medium' : 'font-normal'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
