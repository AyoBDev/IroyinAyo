import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { track } from '../utils/telemetry.js';

export default function PredictionReveal({ data, onClose }) {
  const [phase, setPhase] = useState('beat1');
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('beat2'), 250);
    const t2 = setTimeout(() => {
      setPhase('beat3');
      if (data?.socialTicker) {
        track('reveal_beat3_shown', { condition: data.socialTicker.type });
      }
    }, 850);
    closeTimerRef.current = setTimeout(() => onClose?.(), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [onClose, data]);

  const pauseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const resumeTimer = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onClose?.(), 4000);
  };

  const deltaPp = Math.abs((data.newPrice - data.oldPrice) * 100);
  const state = deltaPp >= 3 ? 'sharp' : deltaPp >= 0.5 ? 'notable' : 'negligible';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={pauseTimer}
        onMouseLeave={resumeTimer}
        onTouchStart={pauseTimer}
        onTouchEnd={resumeTimer}
        className="relative w-full bg-paper border-t border-line shadow-float-lg rounded-t-2xl p-6"
      >
        {/* Beat 1 */}
        <div className="font-serif text-section">Predicted.</div>
        <div className="mt-2 font-mono text-body-sm">
          {data.outcomeLabel} · {data.stake} pts · projected +{data.projectedPayout} pts
        </div>

        {/* Beat 2 */}
        {phase !== 'beat1' && (
          <div className="mt-4">
            <div className="h-2 bg-paper-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${data.newPrice * 100}%` }}
              />
            </div>
            {state !== 'negligible' && (
              <div className="mt-2 font-mono text-body-sm">
                {Math.round(data.oldPrice * 100)}% → {Math.round(data.newPrice * 100)}%
                {state === 'sharp' && (
                  <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-ochre/20 text-ochre text-xs">
                    Sharp move
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Beat 3 */}
        {phase === 'beat3' && data.socialTicker && (
          <div className="mt-4 bg-paper-hover border border-line rounded-xl p-3 font-serif text-body-sm">
            {data.socialTicker.copy}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
