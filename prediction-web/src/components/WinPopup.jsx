import { useState, useEffect, useRef } from 'react';
import { Trophy, X, Sparkles, Share2 } from 'lucide-react';
import { apiFetch, getToken } from '../api.js';

function Confetti({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const particles = [];
    const colors = ['var(--accent-green)', '#10B981', '#facc15', 'var(--primary)', '#6366F1', '#F59E0B', '#EF4444'];

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        speed: Math.random() * 3 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * 360,
        rotation: (Math.random() - 0.5) * 6,
        drift: (Math.random() - 0.5) * 1.5,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speed;
        p.x += p.drift;
        p.angle += p.rotation;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);

  return null;
}

export default function WinPopup() {
  const [wins, setWins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!getToken()) return;
    apiFetch('/api/multi-markets/me/wins')
      .then((data) => {
        if (data && data.length > 0) {
          setWins(data);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    if (currentIndex < wins.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setVisible(false);
      apiFetch('/api/multi-markets/me/wins/acknowledge', { method: 'POST' }).catch(() => {});
    }
  }

  async function handleShare() {
    const win = wins[currentIndex];
    const refParam = win.referral_code ? `?ref=${win.referral_code}` : '';
    const text = `I just won +${win.payout} pts on IroyinMarket!\n"${win.market_title}" — picked ${win.outcome_label}\n\nPredict & compete: ${window.location.origin}${refParam}`;
    try {
      const blob = await generateShareImage(win);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'win.png', { type: 'image/png' })] })) {
        const file = new File([blob], 'iroyinmarket-win.png', { type: 'image/png' });
        await navigator.share({ text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ text });
      } else {
        navigator.clipboard.writeText(text);
      }
    } catch {
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text);
      }
    }
  }

  function generateShareImage(win) {
    return new Promise((resolve) => {
      const size = 1080;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#0A0E17');
      grad.addColorStop(1, '#0f1a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Top accent bar
      const topGrad = ctx.createLinearGradient(0, 0, size, 0);
      topGrad.addColorStop(0, '#10B981');
      topGrad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, size, 8);

      // Trophy circle
      ctx.beginPath();
      ctx.arc(size / 2, 240, 80, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Trophy emoji
      ctx.font = '72px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u{1F3C6}', size / 2, 240);

      // Headline
      ctx.font = 'bold 52px Inter, sans-serif';
      ctx.fillStyle = '#F0F4F8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('I Won on IroyinMarket!', size / 2, 400);

      // Payout
      ctx.font = 'bold 80px Inter, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText(`+${win.payout} pts`, size / 2, 520);

      // Multiplier
      const multiplier = win.amount > 0 ? (win.payout / win.amount).toFixed(1) : '0.0';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`${multiplier}x return`, size / 2, 590);

      // Market title
      ctx.font = '32px Inter, sans-serif';
      ctx.fillStyle = '#7B8BA3';
      let title = win.market_title;
      if (title.length > 45) title = title.slice(0, 42) + '...';
      ctx.fillText(`"${title}"`, size / 2, 680);

      // Outcome
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillStyle = '#F0F4F8';
      ctx.fillText(`Picked: ${win.outcome_label}`, size / 2, 740);

      // Entry price
      if (win.entry_price != null) {
        const entryPercent = Math.round(win.entry_price * 100);
        ctx.font = '28px Inter, sans-serif';
        ctx.fillStyle = '#6366F1';
        ctx.fillText(`Bought at ${entryPercent}%`, size / 2, 800);
      }

      // Divider
      ctx.strokeStyle = 'rgba(123, 139, 163, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size * 0.2, 860);
      ctx.lineTo(size * 0.8, 860);
      ctx.stroke();

      // Referral link
      if (win.referral_code) {
        ctx.font = '28px Inter, sans-serif';
        ctx.fillStyle = '#10B981';
        ctx.fillText(`Join me: iroyinmarket.com/?ref=${win.referral_code}`, size / 2, 920);
      }

      // Brand footer
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillStyle = '#4A5568';
      ctx.fillText('IroyinMarket — Predict & compete for cash', size / 2, 1000);

      c.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  if (!visible || wins.length === 0) return null;

  const win = wins[currentIndex];
  const profit = win.payout - win.amount;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={dismiss}
        className="absolute inset-0 bg-black/50 backdrop-blur-lg"
      />

      {/* Confetti */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />
      <Confetti canvasRef={canvasRef} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-paper rounded-[32px] w-full max-w-[360px] overflow-hidden shadow-float-lg animate-pop-in"
      >
        {/* Decorative gradient top */}
        <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-br from-accent-green-bg to-accent-green-bg/40 opacity-40" />

        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Close button */}
          <button onClick={dismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-paper border border-line flex items-center justify-center text-ink-muted">
            <X size={16} />
          </button>

          {/* Trophy icon with pulsing ring */}
          <div className="relative w-[120px] h-[120px] mb-6">
            <div className="absolute inset-0 rounded-full bg-accent-green-bg animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-accent-green-bg border-2 border-accent-green-border flex items-center justify-center">
              <Trophy size={56} className="text-accent-yellow fill-accent-yellow" />
            </div>
            {/* Sparkles */}
            <Sparkles size={20} className="text-accent-green absolute -top-1 -right-1" />
            <Sparkles size={16} className="text-emerald absolute top-4 -left-2" />
          </div>

          {/* Headline */}
          <h2 className="font-serif text-[32px] text-ink mb-2 tracking-tight">
            You Won!
          </h2>
          <p className="text-sm text-ink-muted mb-6 px-4">
            Your prediction for <span className="font-semibold text-ink">"{win.market_title}"</span> was spot on!
          </p>

          {/* Payout card */}
          <div className="w-full bg-paper border border-line rounded-2xl p-4 mb-6">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
              Total Payout
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[32px] font-bold text-accent-green font-mono">
                +{win.payout} pts
              </span>
            </div>
            {profit > 0 && (
              <span className="text-xs text-ink-muted mt-1 block font-mono">
                {win.amount} invested &rarr; {profit} profit
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3">
            <button onClick={handleShare} className="w-full py-3.5 bg-emerald text-bone rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-deep">
              <Share2 size={16} />
              Share to Social
            </button>
            <button onClick={dismiss} className="w-full py-3 text-ink-muted text-[13px] font-semibold">
              {currentIndex < wins.length - 1 ? 'Next Win →' : 'Back to Market'}
            </button>
          </div>

          {wins.length > 1 && (
            <div className="text-[11px] text-ink-muted mt-2 font-mono">
              {currentIndex + 1} of {wins.length} wins
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
