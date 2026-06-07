import { TrendingUp, Wallet, HelpCircle } from 'lucide-react';
import useStore from '../store.js';

export default function TopBar() {
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);
  const requestTutorialReplay = useStore((s) => s.requestTutorialReplay);

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
            <div data-tutorial="points-balance" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-paper border border-line">
              <Wallet size={14} className="text-ink-muted" />
              <span className="font-mono text-mono-data font-normal text-emerald">
                {user.points_balance}
              </span>
              <span className="text-[11px] text-ink-muted">pts</span>
            </div>
            <button
              onClick={requestTutorialReplay}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-paper border border-line text-ink-muted hover:text-emerald transition-colors"
              aria-label="How it works"
            >
              <HelpCircle size={18} />
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
