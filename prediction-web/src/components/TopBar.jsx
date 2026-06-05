import { TrendingUp, Wallet } from 'lucide-react';
import useStore from '../store.js';

export default function TopBar({ onPositionsClick }) {
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] h-14 flex justify-between items-center px-4 bg-bone border-b border-line">
      <div className="flex items-center gap-2.5">
        <TrendingUp size={22} className="text-emerald" strokeWidth={2.5} />
        <h1 className="font-serif text-lg tracking-tight text-ink">
          IroyinMarket
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-paper border border-line">
              <Wallet size={14} className="text-ink-muted" />
              <span className="font-mono text-mono-data font-normal text-emerald">
                {user.points_balance}
              </span>
              <span className="text-[11px] text-ink-muted">pts</span>
            </div>
            <button
              onClick={onPositionsClick}
              className="bg-emerald text-bone px-4 py-1.5 rounded-xl text-label-sm font-medium hover:bg-emerald-deep transition-colors"
            >
              Portfolio
            </button>
          </>
        ) : (
          <button
            onClick={openAuthModal}
            className="bg-emerald text-bone px-4 py-1.5 rounded-xl text-label-sm font-medium hover:bg-emerald-deep transition-colors"
          >
            Join
          </button>
        )}
      </div>
    </header>
  );
}
