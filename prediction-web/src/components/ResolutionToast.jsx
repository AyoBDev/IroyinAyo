import { Trophy, X } from 'lucide-react';
import useStore from '../store.js';

export default function ResolutionToast() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);

  if (!toast || toast.type !== 'resolution') return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up bg-paper border border-accent-green-border rounded-2xl py-3.5 px-5 flex items-center gap-3 shadow-float max-w-[360px] w-[calc(100%-32px)]">
      <Trophy size={22} className="text-accent-yellow" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-accent-green mb-0.5">
          Market Resolved!
        </div>
        <div className="text-xs text-ink-muted overflow-hidden text-ellipsis whitespace-nowrap">
          {toast.winner} wins "{toast.title}"
        </div>
      </div>
      <button onClick={dismiss} className="text-ink-muted p-1">
        <X size={14} />
      </button>
    </div>
  );
}
