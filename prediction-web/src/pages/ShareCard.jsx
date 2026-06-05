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
      <div className="flex justify-center items-center min-h-screen p-6">
        <div className="w-6 h-6 border-2 border-line border-t-emerald rounded-full animate-spin" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-ink-muted text-sm mb-4">Market not found</p>
        <Link to="/" className="text-emerald text-[13px] font-semibold">Go to Markets</Link>
      </div>
    );
  }

  const isResolved = market.status === 'resolved';
  const percent = market.topOutcome ? Math.round(market.topOutcome.price * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* The Card */}
      <div className={`w-full max-w-[380px] rounded-2xl border overflow-hidden relative ${isResolved ? 'bg-gradient-to-br from-paper to-accent-green-bg border-accent-green/30' : 'bg-gradient-to-br from-paper to-emerald/5 border-emerald/30'}`}>
        {/* Top accent bar */}
        <div className={`h-1 ${isResolved ? 'bg-gradient-to-r from-accent-green to-accent-yellow' : 'bg-gradient-to-r from-emerald to-accent-violet'}`} />

        <div className="p-6">
          {/* Brand */}
          <div className="flex items-center gap-1.5 mb-5">
            <TrendingUp size={14} className="text-emerald" />
            <span className="text-[11px] font-bold text-emerald tracking-wide uppercase">
              IroyinMarket
            </span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-base font-bold leading-relaxed mb-5 text-ink">
            {market.title}
          </h1>

          {/* Result box */}
          {isResolved ? (
            <div className="flex items-center gap-3 p-4 bg-bone rounded-lg border border-accent-green/30">
              <div className="w-10 h-10 rounded-full bg-accent-yellow-bg flex items-center justify-center shrink-0">
                <Trophy size={20} className="text-accent-yellow" />
              </div>
              <div>
                <div className="text-[11px] text-ink-muted mb-1 font-medium">Winner</div>
                <div className="font-serif text-lg font-bold text-accent-green">
                  {market.winner.label}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-bone rounded-lg border border-line">
              <div className="flex flex-col items-center min-w-[50px]">
                <span className="font-mono text-[28px] font-extrabold text-accent-green leading-none">{percent}</span>
                <span className="text-[11px] text-ink-muted font-semibold">%</span>
              </div>
              <div>
                <div className="text-[11px] text-ink-muted mb-1 font-medium">Leading</div>
                <div className="text-[15px] font-semibold text-ink">
                  {market.topOutcome?.label}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  {market.outcomeCount} options
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">
              {isResolved ? 'Market resolved' : 'Live predictions'}
            </span>
            <span className="text-[11px] text-accent-violet font-semibold">
              Predict & compete for cash
            </span>
          </div>
        </div>
      </div>

      {/* Actions below card */}
      <div className="w-full max-w-[380px] mt-5 flex flex-col gap-2.5">
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald border-none rounded-full text-white text-[13px] font-bold"
        >
          <Share2 size={15} /> Share
        </button>

        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-paper border border-line rounded-full text-ink text-[13px] font-semibold"
        >
          {copied ? <><Check size={15} className="text-accent-green" /> Copied!</> : <><Copy size={15} /> Copy Link</>}
        </button>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-transparent border-none rounded-full text-emerald text-[13px] font-semibold no-underline"
        >
          Make your predictions <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
