import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Clock, Users, MessageSquare, TrendingUp, Trophy, Flag } from 'lucide-react';
import useStore from '../store.js';
import { apiFetch, getToken } from '../api.js';
import PredictSlip from '../components/PredictSlip.jsx';
import PublicChat from '../components/PublicChat.jsx';

function PriceChart({ outcomes }) {
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);
  const top = sorted[0];
  if (!top) return null;

  const topPercent = Math.round(top.price * 100);

  return (
    <div className="bg-paper rounded-2xl border border-line p-5 relative overflow-hidden h-[200px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-serif text-base font-semibold">Price History</h3>
        <div className="flex gap-1">
          {['1D', '1W', '1M'].map((label, i) => (
            <button key={label} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${i === 1 ? 'bg-accent-green-bg text-emerald border-emerald/30' : 'bg-paper text-ink-muted border-line'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-[120px] px-5"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--color-emerald)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-emerald)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path
          d={`M0,${100 - topPercent * 0.8} Q100,${100 - topPercent * 0.7} 200,${100 - topPercent * 0.85} T400,${100 - topPercent}`}
          fill="none"
          stroke="var(--color-emerald)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={`M0,${100 - topPercent * 0.8} Q100,${100 - topPercent * 0.7} 200,${100 - topPercent * 0.85} T400,${100 - topPercent} V100 H0 Z`}
          fill="url(#chartGrad)"
        />
      </svg>
    </div>
  );
}

function OutcomeButtons({ market, outcomes }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);

  const isBinary = outcomes.length === 2 &&
    outcomes.some(o => o.label.toLowerCase().startsWith('yes')) &&
    outcomes.some(o => o.label.toLowerCase().startsWith('no'));

  if (isBinary) {
    const yesOutcome = outcomes.find(o => o.label.toLowerCase().startsWith('yes'));
    const noOutcome = outcomes.find(o => o.label.toLowerCase().startsWith('no'));
    const yesPercent = Math.round(yesOutcome.price * 100);
    const noPercent = Math.round(noOutcome.price * 100);

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedOutcome(selectedOutcome === yesOutcome.id ? null : yesOutcome.id)}
            className={`flex flex-col items-center gap-1 p-4 rounded-2xl border text-base font-bold transition-all duration-150 ${selectedOutcome === yesOutcome.id ? 'bg-accent-green text-white border-accent-green' : 'bg-accent-green-bg text-accent-green border-accent-green/30'}`}
          >
            <span>Yes</span>
            <span className="text-[13px] opacity-80">{yesPercent}%</span>
          </button>
          <button
            onClick={() => setSelectedOutcome(selectedOutcome === noOutcome.id ? null : noOutcome.id)}
            className={`flex flex-col items-center gap-1 p-4 rounded-2xl border text-base font-bold transition-all duration-150 ${selectedOutcome === noOutcome.id ? 'bg-accent-red text-white border-accent-red' : 'bg-accent-red-bg text-accent-red border-accent-red/30'}`}
          >
            <span>No</span>
            <span className="text-[13px] opacity-80">{noPercent}%</span>
          </button>
        </div>
        {selectedOutcome && (
          <PredictSlip
            market={market}
            outcome={outcomes.find(o => o.id === selectedOutcome)}
            onClose={() => setSelectedOutcome(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((outcome, index) => {
        const percent = Math.round(outcome.price * 100);
        const isTop = index === 0;
        const isSelected = selectedOutcome === outcome.id;

        return (
          <div key={outcome.id}>
            <button
              onClick={() => setSelectedOutcome(isSelected ? null : outcome.id)}
              className={`w-full flex justify-between items-center px-4 py-3.5 rounded-lg border transition-all duration-150 ${isSelected ? 'bg-accent-green-bg border-emerald/30' : isTop ? 'bg-paper border-line' : 'bg-paper border-line'}`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isTop ? 'bg-emerald' : 'bg-ink-muted'}`} />
                <span className={`text-sm text-ink ${isTop ? 'font-semibold' : 'font-normal'}`}>
                  {outcome.label}
                </span>
              </div>
              <span className={`font-mono text-sm font-bold ${isTop ? 'text-emerald' : 'text-ink-muted'}`}>
                {percent}%
              </span>
            </button>
            {isSelected && (
              <div className="mt-2">
                <PredictSlip market={market} outcome={outcome} onClose={() => setSelectedOutcome(null)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreatorResolvePanel({ market }) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fetchMarkets = useStore((s) => s.fetchMarkets);

  const totalVolume = market.outcomes.reduce((sum, o) => sum + (o.shares_sold || 0), 0);
  const estimatedFee = Math.floor(totalVolume * 0.05);

  async function handleResolve(outcomeId) {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    setResolving(true);
    setError('');
    try {
      await apiFetch(`/api/multi-markets/${market.id}/creator-resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcomeId }),
      });
      fetchMarkets();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-muted mb-2">
        Your Market
      </h3>
      <div className="p-3 rounded-lg bg-paper border border-line mb-3 text-[13px] text-ink-muted">
        <div className="flex justify-between">
          <span>Total volume</span>
          <span className="font-mono font-semibold text-ink">{totalVolume} pts</span>
        </div>
        <div className="flex justify-between mt-1.5">
          <span>Your earnings on resolve</span>
          <span className="font-mono font-semibold text-accent-green">~{estimatedFee} pts</span>
        </div>
      </div>
      <p className="text-xs text-ink-muted mb-3">
        Select the winning outcome to resolve this market and pay out predictions.
      </p>
      {error && (
        <div className="text-accent-red text-xs mb-2.5 font-semibold">{error}</div>
      )}
      <div className="flex flex-col gap-2">
        {market.outcomes.map((o) => (
          <button
            key={o.id}
            onClick={() => handleResolve(o.id)}
            disabled={resolving}
            className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-paper border border-line text-ink text-sm font-medium text-left ${resolving ? 'opacity-60' : ''}`}
          >
            <Trophy size={16} className="text-accent-yellow" />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SocialSection({ market }) {
  const [showChat, setShowChat] = useState(true);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-base font-semibold">Commentary</h3>
        <button
          onClick={() => setShowChat(!showChat)}
          className="text-xs font-semibold text-emerald bg-transparent px-2 py-1"
        >
          {showChat ? 'Hide' : 'Show'}
        </button>
      </div>

      {showChat && (
        <div className="bg-paper rounded-2xl border border-line overflow-hidden">
          <PublicChat marketId={market.id} />
        </div>
      )}
    </section>
  );
}

export default function MarketDetail() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  const markets = useStore((s) => s.markets);
  const user = useStore((s) => s.user);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const market = markets.find((m) => m.id === marketId);
  const isCreator = user && market && market.created_by && market.created_by === user.id;

  async function handleReport() {
    if (reportReason.trim().length < 5) return;
    setReporting(true);
    try {
      await apiFetch(`/api/multi-markets/${market.id}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      setShowReport(false);
      setReportReason('');
    } catch {} finally {
      setReporting(false);
    }
  }

  if (!market) {
    return (
      <div className="py-[60px] px-4 text-center">
        <p className="text-ink-muted text-sm">Market not found</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-5 py-2.5 rounded-lg bg-emerald text-white text-[13px] font-semibold"
        >
          Back to Markets
        </button>
      </div>
    );
  }

  const outcomes = market.outcomes || [];
  const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);
  const topOutcome = sortedOutcomes[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;
  const totalShares = outcomes.reduce((sum, o) => sum + (o.shares_sold || 0), 0);

  function generateShareImage() {
    return new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 600, 400);
      grad.addColorStop(0, '#0A0E17');
      grad.addColorStop(1, '#0f1a2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 400);

      const topGrad = ctx.createLinearGradient(0, 0, 600, 0);
      topGrad.addColorStop(0, '#6366F1');
      topGrad.addColorStop(1, '#10B981');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, 600, 5);

      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillStyle = '#F0F4F8';
      ctx.textAlign = 'center';
      let title = market.title;
      if (title.length > 50) title = title.slice(0, 47) + '...';
      ctx.fillText(title, 300, 60);

      if (market.category) {
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#6366F1';
        ctx.fillText(market.category.toUpperCase(), 300, 90);
      }

      const sorted = [...outcomes].sort((a, b) => b.price - a.price).slice(0, 5);
      const barStartY = 120;
      sorted.forEach((o, i) => {
        const y = barStartY + i * 48;
        const pct = Math.round(o.price * 100);
        const barWidth = Math.max(pct * 3.5, 20);

        ctx.fillStyle = i === 0 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(80, y, barWidth, 30, 6);
        ctx.fill();

        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = i === 0 ? '#6366F1' : '#7B8BA3';
        ctx.textAlign = 'left';
        ctx.fillText(`${pct}%`, 85, y + 20);

        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#F0F4F8';
        let label = o.label;
        if (label.length > 25) label = label.slice(0, 22) + '...';
        ctx.fillText(label, 130, y + 20);
      });

      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = '#4A5568';
      ctx.textAlign = 'center';
      ctx.fillText(`${totalShares} predictions`, 300, 365);

      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = '#6366F1';
      ctx.fillText('IroyinMarket', 300, 388);

      c.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/market/${market.id}`;
    const text = `${topOutcome?.label} leads at ${topPercent}% — "${market.title}" on IroyinMarket`;

    try {
      const blob = await generateShareImage();
      const file = new File([blob], 'iroyinmarket-prediction.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text, url: shareUrl, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ text, url: shareUrl });
      } else {
        navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      }
    } catch {
      if (navigator.share) {
        navigator.share({ text, url: shareUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      }
    }
  };

  return (
    <div className="p-4 max-w-[640px] mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-ink-muted hover:text-ink text-[13px] font-medium bg-transparent mb-4 py-1"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="flex flex-col gap-5">
        {/* Market Identity */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {market.category && (
              <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-accent-green-bg text-emerald border border-emerald/30 uppercase">
                {market.category}
              </span>
            )}
            {market.is_featured && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-yellow-bg text-accent-yellow border border-accent-yellow/30 flex items-center gap-1">
                <Trophy size={11} /> Featured
              </span>
            )}
          </div>

          <h2 className="font-serif text-section font-bold leading-tight tracking-tight">
            {market.title}
          </h2>

          {market.creator_name && (
            <span className="text-xs font-medium text-ink-muted flex items-center gap-1">
              Created by <span className="font-semibold text-ink-muted">{market.creator_name}</span>
            </span>
          )}

          {/* Probability summary */}
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-mono-data font-extrabold text-emerald">
              {topPercent}%
            </span>
            <span className="text-sm text-ink-muted">
              {topOutcome?.label}
            </span>
          </div>

          {/* Description */}
          {market.description && (
            <div className="p-3.5 rounded-lg bg-paper border border-line text-[13px] leading-relaxed text-ink-muted whitespace-pre-line">
              {market.description}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-ink-muted">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span className="text-xs font-medium">{totalShares} predictions</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">{outcomes.length} outcomes</span>
            </div>
            <button onClick={handleShare} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-paper border border-line text-ink-muted text-xs font-medium">
              <Share2 size={13} /> Share
            </button>
            {market.created_by && !isCreator && (
              <button onClick={() => setShowReport(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-paper border border-line text-ink-muted text-xs">
                <Flag size={12} />
              </button>
            )}
          </div>
        </section>

        {/* Chart */}
        <PriceChart outcomes={outcomes} />

        {/* Action section */}
        <section>
          {isCreator && market.status === 'open' ? (
            <CreatorResolvePanel market={market} />
          ) : (
            <>
              <h3 className="text-sm font-semibold text-ink-muted mb-3">
                Make a prediction
              </h3>
              <OutcomeButtons market={market} outcomes={outcomes} />
            </>
          )}
        </section>

        {/* Social / Commentary */}
        <SocialSection market={market} />
      </div>

      {showReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div onClick={() => setShowReport(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-paper rounded-2xl p-6 w-full max-w-[340px]">
            <h3 className="text-base font-bold mb-3 text-ink">Report Market</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why are you reporting this market?"
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-bone border border-line rounded-md text-ink resize-none"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 rounded-md bg-paper border border-line text-ink-muted text-[13px] font-semibold">Cancel</button>
              <button onClick={handleReport} disabled={reporting || reportReason.trim().length < 5} className={`px-4 py-2 rounded-md bg-accent-red text-white text-[13px] font-semibold border-none ${reporting ? 'opacity-60' : ''}`}>Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
