import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, TrendingUp, Share2, Copy, Check, ArrowRight } from 'lucide-react';

export default function ShareCard() {
  const { marketId } = useParams();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/multi-markets/${marketId}/share`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setMarket(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [marketId]);

  const shareUrl = `${window.location.origin}/share/${marketId}`;

  const handleShare = () => {
    const text = market.winner
      ? `${market.winner.label} won "${market.title}" on IroyinMarket!`
      : `${market.topOutcome?.label} leads at ${Math.round((market.topOutcome?.price || 0) * 100)}% — "${market.title}" on IroyinMarket`;

    if (navigator.share) {
      navigator.share({ text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!market) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Market not found</p>
        <Link to="/" style={{ color: 'var(--accent-blue)', fontSize: '13px', fontWeight: 600 }}>Go to Markets</Link>
      </div>
    );
  }

  const isResolved = market.status === 'resolved';
  const percent = market.topOutcome ? Math.round(market.topOutcome.price * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* The Card */}
      <div style={{
        width: '100%', maxWidth: '380px',
        background: isResolved
          ? 'linear-gradient(145deg, var(--bg-card), var(--accent-green-bg))'
          : 'linear-gradient(145deg, var(--bg-card), var(--accent-blue-bg))',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${isResolved ? 'var(--accent-green-border)' : 'var(--accent-blue-border)'}`,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Top accent bar */}
        <div style={{
          height: '4px',
          background: isResolved
            ? 'linear-gradient(90deg, var(--accent-green), var(--accent-yellow))'
            : 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
        }} />

        <div style={{ padding: '24px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
            <TrendingUp size={14} color="var(--accent-blue)" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              IroyinMarket
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.4, marginBottom: '20px', color: 'var(--text-primary)' }}>
            {market.title}
          </h1>

          {/* Result box */}
          {isResolved ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '16px', background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-green-border)',
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-yellow-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy size={20} color="var(--accent-yellow)" />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 500 }}>Winner</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-green)' }}>
                  {market.winner.label}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '16px', background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-green)', lineHeight: 1 }}>{percent}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>%</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 500 }}>Leading</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {market.topOutcome?.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {market.outcomeCount} options
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {isResolved ? 'Market resolved' : 'Live predictions'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--accent-violet)', fontWeight: 600 }}>
              Predict & compete for cash
            </span>
          </div>
        </div>
      </div>

      {/* Actions below card */}
      <div style={{ width: '100%', maxWidth: '380px', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px',
            background: 'var(--accent-blue)', border: 'none',
            borderRadius: '9999px', color: '#fff',
            fontSize: '13px', fontWeight: 700,
          }}
        >
          <Share2 size={15} /> Share
        </button>

        <button
          onClick={handleCopyLink}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '9999px', color: 'var(--text-primary)',
            fontSize: '13px', fontWeight: 600,
          }}
        >
          {copied ? <><Check size={15} color="var(--accent-green)" /> Copied!</> : <><Copy size={15} /> Copy Link</>}
        </button>

        <Link
          to="/"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px',
            background: 'transparent', border: 'none',
            borderRadius: '9999px', color: 'var(--accent-blue)',
            fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Make your predictions <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
