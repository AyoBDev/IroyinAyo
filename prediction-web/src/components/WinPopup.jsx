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

  function handleShare() {
    const win = wins[currentIndex];
    const text = `I just won +${win.payout} pts on IroyinMarket!\n"${win.market_title}" — picked ${win.outcome_label}\n\nPredict & compete: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  if (!visible || wins.length === 0) return null;

  const win = wins[currentIndex];
  const profit = win.payout - win.amount;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(11, 28, 48, 0.5)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Confetti */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
      />
      <Confetti canvasRef={canvasRef} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--bg-card)',
          borderRadius: '32px',
          width: '100%', maxWidth: '360px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {/* Decorative gradient top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '120px',
          background: 'linear-gradient(135deg, var(--accent-green-bg), var(--primary-bg))',
          opacity: 0.4,
        }} />

        <div style={{ position: 'relative', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* Close button */}
          <button onClick={dismiss} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--bg-surface-container)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)',
          }}>
            <X size={16} />
          </button>

          {/* Trophy icon with pulsing ring */}
          <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '24px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'var(--accent-green-bg)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'relative', width: '100%', height: '100%', borderRadius: '50%',
              background: 'var(--accent-green-bg)', border: '2px solid var(--accent-green-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trophy size={56} color="var(--accent-yellow)" fill="var(--accent-yellow)" />
            </div>
            {/* Sparkles */}
            <Sparkles size={20} color="var(--accent-green)" style={{ position: 'absolute', top: '-4px', right: '-4px' }} />
            <Sparkles size={16} color="var(--primary)" style={{ position: 'absolute', top: '16px', left: '-8px' }} />
          </div>

          {/* Headline */}
          <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
            You Won!
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', padding: '0 16px' }}>
            Your prediction for <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>"{win.market_title}"</span> was spot on!
          </p>

          {/* Payout card */}
          <div style={{
            width: '100%', background: 'var(--bg-surface-container)',
            borderRadius: '16px', padding: '16px', marginBottom: '24px',
            border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
              Total Payout
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent-green)' }}>
                +{win.payout} pts
              </span>
            </div>
            {profit > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                {win.amount} invested → {profit} profit
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleShare} style={{
              width: '100%', padding: '14px',
              background: 'var(--primary)', color: '#fff',
              borderRadius: 'var(--radius-xl)', fontSize: '14px', fontWeight: 600,
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <Share2 size={16} />
              Share to Social
            </button>
            <button onClick={dismiss} style={{
              width: '100%', padding: '12px',
              background: 'transparent', color: 'var(--text-secondary)',
              border: 'none', fontSize: '13px', fontWeight: 600,
            }}>
              {currentIndex < wins.length - 1 ? 'Next Win →' : 'Back to Market'}
            </button>
          </div>

          {wins.length > 1 && (
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              {currentIndex + 1} of {wins.length} wins
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
