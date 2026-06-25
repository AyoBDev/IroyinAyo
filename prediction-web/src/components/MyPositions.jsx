import { X, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import useStore from '../store.js';

export default function MyPositions({ onClose }) {
  const user = useStore((s) => s.user);
  if (!user) return null;

  const positions = useStore((s) => s.positions);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex justify-center items-start pt-[60px] px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper rounded-2xl border border-line w-full max-w-[480px] max-h-[75vh] overflow-auto animate-slide-up shadow-float"
      >
        <div className="py-4 px-5 border-b border-line flex justify-between items-center sticky top-0 bg-paper z-[1]">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent-green" />
            <h3 className="font-serif text-sm text-ink">Portfolio</h3>
            {positions.length > 0 && (
              <span className="text-[11px] font-bold text-ink-muted bg-bone py-0.5 px-2 rounded-full font-mono">
                {positions.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="bg-bone text-ink-muted w-7 h-7 flex items-center justify-center rounded-md">
            <X size={14} />
          </button>
        </div>

        {positions.length === 0 ? (
          <div className="py-12 px-5 text-center">
            <TrendingUp size={28} className="text-ink-muted mb-3" />
            <p className="text-ink-muted text-[13px]">
              No predictions yet. Pick a market to get started.
            </p>
          </div>
        ) : (
          <div className="p-2">
            {positions.map((pos) => {
              const isWin = pos.payout > 0;
              return (
                <div key={pos.id} className="py-3.5 px-4 rounded-lg border border-line my-1 bg-bone">
                  <div className="text-[11px] text-ink-muted mb-1.5 font-medium">
                    {pos.market_title}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold">{pos.outcome_label}</span>
                    <div className="text-right">
                      {pos.market_status === 'resolved' ? (
                        <div className="flex items-center gap-1">
                          {isWin ? <ArrowUpRight size={14} className="text-accent-green" /> : <ArrowDownRight size={14} className="text-accent-red" />}
                          <span className={`text-[13px] font-bold font-mono ${isWin ? 'text-accent-green' : 'text-accent-red'}`}>
                            {isWin ? `+${pos.payout} pts` : 'Lost'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="text-[13px] font-bold text-accent-green font-mono">
                            {Number(pos.shares).toFixed(1)} shares
                          </div>
                          <div className="text-[10px] text-ink-muted mt-0.5 font-mono">
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
