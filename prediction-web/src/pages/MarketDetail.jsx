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
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', padding: '20px',
      position: 'relative', overflow: 'hidden', height: '200px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Price History</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['1D', '1W', '1M'].map((label, i) => (
            <button key={label} style={{
              padding: '4px 10px', borderRadius: 'var(--radius)',
              fontSize: '11px', fontWeight: 600,
              background: i === 1 ? 'var(--primary-bg)' : 'var(--bg-surface-container)',
              color: i === 1 ? 'var(--primary)' : 'var(--text-tertiary)',
              border: i === 1 ? '1px solid var(--primary-border)' : '1px solid var(--border)',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', padding: '0 20px' }}
      >
        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--primary)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'var(--primary)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path
          d={`M0,${100 - topPercent * 0.8} Q100,${100 - topPercent * 0.7} 200,${100 - topPercent * 0.85} T400,${100 - topPercent}`}
          fill="none"
          stroke="var(--primary)"
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => setSelectedOutcome(selectedOutcome === yesOutcome.id ? null : yesOutcome.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '16px', borderRadius: 'var(--radius-xl)',
              background: selectedOutcome === yesOutcome.id ? 'var(--accent-green)' : 'var(--accent-green-bg)',
              color: selectedOutcome === yesOutcome.id ? '#fff' : 'var(--accent-green)',
              border: '1px solid var(--accent-green-border)',
              fontSize: '16px', fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Yes</span>
            <span style={{ fontSize: '13px', opacity: 0.8 }}>{yesPercent}%</span>
          </button>
          <button
            onClick={() => setSelectedOutcome(selectedOutcome === noOutcome.id ? null : noOutcome.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '16px', borderRadius: 'var(--radius-xl)',
              background: selectedOutcome === noOutcome.id ? 'var(--accent-red)' : 'var(--accent-red-bg)',
              color: selectedOutcome === noOutcome.id ? '#fff' : 'var(--accent-red)',
              border: '1px solid var(--accent-red-border)',
              fontSize: '16px', fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            <span>No</span>
            <span style={{ fontSize: '13px', opacity: 0.8 }}>{noPercent}%</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {sorted.map((outcome, index) => {
        const percent = Math.round(outcome.price * 100);
        const isTop = index === 0;
        const isSelected = selectedOutcome === outcome.id;

        return (
          <div key={outcome.id}>
            <button
              onClick={() => setSelectedOutcome(isSelected ? null : outcome.id)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                background: isSelected ? 'var(--primary-bg)' : isTop ? 'var(--bg-surface-container)' : 'var(--bg-card)',
                border: isSelected ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: isTop ? 'var(--primary)' : 'var(--text-tertiary)',
                }} />
                <span style={{
                  fontSize: '14px', fontWeight: isTop ? 600 : 400,
                  color: 'var(--text-primary)',
                }}>
                  {outcome.label}
                </span>
              </div>
              <span style={{
                fontSize: '14px', fontWeight: 700,
                color: isTop ? 'var(--primary)' : 'var(--text-secondary)',
              }}>
                {percent}%
              </span>
            </button>
            {isSelected && (
              <div style={{ marginTop: '8px' }}>
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
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
        Your Market
      </h3>
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface-container)', border: '1px solid var(--border)',
        marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Total volume</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalVolume} pts</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span>Your earnings on resolve</span>
          <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>~{estimatedFee} pts</span>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        Select the winning outcome to resolve this market and pay out predictions.
      </p>
      {error && (
        <div style={{ color: 'var(--accent-red)', fontSize: '12px', marginBottom: '10px', fontWeight: 600 }}>{error}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {market.outcomes.map((o) => (
          <button
            key={o.id}
            onClick={() => handleResolve(o.id)}
            disabled={resolving}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500,
              opacity: resolving ? 0.6 : 1, textAlign: 'left',
            }}
          >
            <Trophy size={16} color="var(--accent-yellow)" />
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
    <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Commentary</h3>
        <button
          onClick={() => setShowChat(!showChat)}
          style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--primary)',
            background: 'none', padding: '4px 8px',
          }}
        >
          {showChat ? 'Hide' : 'Show'}
        </button>
      </div>

      {showChat && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
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

  const market = markets.find((m) => m.id === marketId);
  const isCreator = user && market && market.created_by && market.created_by === user.id;

  if (!market) {
    return (
      <div style={{ padding: '60px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Market not found</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '16px', padding: '10px 20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--primary)', color: '#fff', fontSize: '13px', fontWeight: 600,
          }}
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

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${market.id}`;
    const text = `${topOutcome?.label} leads at ${topPercent}% — "${market.title}" on IroyinMarket`;
    if (navigator.share) {
      navigator.share({ text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
          background: 'none', marginBottom: '16px', padding: '4px 0',
        }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Market Identity */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {market.category && (
              <span style={{
                fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px',
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--primary-bg)', color: 'var(--primary)',
                border: '1px solid var(--primary-border)',
                textTransform: 'uppercase',
              }}>
                {market.category}
              </span>
            )}
            {market.is_featured && (
              <span style={{
                fontSize: '11px', fontWeight: 600,
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)',
                border: '1px solid var(--accent-yellow-border)',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Trophy size={11} /> Featured
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
            {market.title}
          </h2>

          {market.creator_name && (
            <span style={{
              fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              Created by <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{market.creator_name}</span>
            </span>
          )}

          {/* Probability summary */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)' }}>
              {topPercent}%
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {topOutcome?.label}
            </span>
          </div>

          {/* Description */}
          {market.description && (
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface-container)', border: '1px solid var(--border)',
              fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)',
              whiteSpace: 'pre-line',
            }}>
              {market.description}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={14} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>{totalShares} predictions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={14} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>{outcomes.length} outcomes</span>
            </div>
            <button onClick={handleShare} style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 12px', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface-container)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500,
            }}>
              <Share2 size={13} /> Share
            </button>
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
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Make a prediction
              </h3>
              <OutcomeButtons market={market} outcomes={outcomes} />
            </>
          )}
        </section>

        {/* Social / Commentary */}
        <SocialSection market={market} />
      </div>
    </div>
  );
}
