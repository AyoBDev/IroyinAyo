import { useState, useRef } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import useStore from '../store.js';
import Confetti from './Confetti.jsx';

export default function DailyRefillPopup() {
  const pendingRefill = useStore((s) => s.pendingRefill);
  const claimRefill = useStore((s) => s.claimRefill);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  if (!pendingRefill) return null;

  const seenKey = `refillSeen_${pendingRefill.id}`;
  if (typeof window !== 'undefined' && window.sessionStorage?.getItem(seenKey) === '1') {
    return null;
  }

  async function handleClaim() {
    setLoading(true);
    setError('');
    try {
      await claimRefill(pendingRefill.id);
      sessionStorage.setItem(seenKey, '1');
    } catch (err) {
      setError(err.message || 'Could not claim refill. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1100] p-4">
      <div className="absolute inset-0 bg-black/70" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />
      <Confetti canvasRef={canvasRef} />
      <div className="relative bg-bone rounded-2xl p-8 max-w-[360px] w-full text-center shadow-float-lg animate-pop-in">
        <Gift size={40} className="text-accent-green mb-4 mx-auto" strokeWidth={2.5} />
        <p className="font-serif text-section text-ink mb-1">Daily refill</p>
        <p className="font-mono text-[44px] font-extrabold text-emerald my-3 leading-none">
          +{pendingRefill.amount}
        </p>
        <p className="text-ink-muted text-xs mb-6">
          You're back in the game.
        </p>
        {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
        <button
          onClick={handleClaim}
          disabled={loading}
          className={`flex items-center justify-center gap-2 py-3 px-6 rounded-full text-sm font-bold bg-emerald text-bone w-full ${
            loading ? 'opacity-60' : 'hover:bg-emerald-deep'
          }`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Claim {pendingRefill.amount} points
        </button>
      </div>
    </div>
  );
}
