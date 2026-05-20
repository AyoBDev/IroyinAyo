import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Search, Trophy, Share2 } from 'lucide-react';
import OutcomeRow from './OutcomeRow.jsx';
import PredictSlip from './PredictSlip.jsx';
import MiniChart from './MiniChart.jsx';

const PAGE_SIZE = 10;

function LargeMarketCard({ market }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const sortedOutcomes = [...(market.outcomes || [])].sort((a, b) => b.price - a.price);

  const filtered = search
    ? sortedOutcomes.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : sortedOutcomes;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedOutcomes = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const topOutcome = sortedOutcomes[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{market.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '60px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)', lineHeight: 1 }}>
              {topPercent}<span style={{ fontSize: '13px', fontWeight: 600 }}>%</span>
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>top</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{topOutcome?.label}</span>
            <span style={{ marginLeft: '8px', padding: '2px 6px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '11px' }}>
              {sortedOutcomes.length} options
            </span>
          </div>
          <MiniChart outcomes={sortedOutcomes} />
        </div>
      </div>

      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              width: '100%', padding: '8px 12px 8px 30px', fontSize: '12px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '0 8px 4px' }}>
        {paginatedOutcomes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            No results for "{search}"
          </div>
        ) : (
          paginatedOutcomes.map((outcome) => (
            <div key={outcome.id}>
              <OutcomeRow
                outcome={outcome}
                isSelected={selectedOutcome === outcome.id}
                onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
              />
              {selectedOutcome === outcome.id && (
                <div style={{ padding: '0 8px 8px' }}>
                  <PredictSlip market={market} outcome={outcome} onClose={() => setSelectedOutcome(null)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: 'var(--radius)',
              background: page === 0 ? 'transparent' : 'var(--bg-card)',
              color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              border: `1px solid ${page === 0 ? 'transparent' : 'var(--border)'}`,
              cursor: page === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', opacity: page === 0 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: 'var(--radius)',
              background: page === totalPages - 1 ? 'transparent' : 'var(--bg-card)',
              color: page === totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              border: `1px solid ${page === totalPages - 1 ? 'transparent' : 'var(--border)'}`,
              cursor: page === totalPages - 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', opacity: page === totalPages - 1 ? 0.4 : 1,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function SmallMarketCard({ market }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  const sortedOutcomes = [...(market.outcomes || [])].sort((a, b) => b.price - a.price);
  const topOutcome = sortedOutcomes[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;

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
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4, marginBottom: '10px', flex: 1 }}>
            {market.title}
          </h2>
          <button onClick={handleShare} style={{ padding: '6px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <Share2 size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-green)', lineHeight: 1 }}>
            {topPercent}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>%</span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
            {topOutcome?.label}
          </span>
        </div>
      </div>

      {/* Outcomes */}
      <div style={{ padding: '0 8px 8px' }}>
        {sortedOutcomes.map((outcome) => (
          <div key={outcome.id}>
            <OutcomeRow
              outcome={outcome}
              isSelected={selectedOutcome === outcome.id}
              onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
            />
            {selectedOutcome === outcome.id && (
              <div style={{ padding: '0 8px 8px' }}>
                <PredictSlip market={market} outcome={outcome} onClose={() => setSelectedOutcome(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolvedMarketCard({ market }) {
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${market.id}`;
    const text = `${market.winnerLabel} won "${market.title}" on IroyinMarket!`;
    if (navigator.share) {
      navigator.share({ text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, var(--bg-card), var(--accent-green-bg))',
      borderRadius: 'var(--radius-xl)',
      padding: '20px', border: '1px solid var(--accent-green-border)',
      position: 'relative', overflow: 'hidden',
      animation: 'fadeIn 0.4s ease-out',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, var(--accent-green), var(--accent-yellow))',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>{market.title}</h2>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)',
          background: 'var(--accent-green-bg)', padding: '4px 10px', borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--accent-green-border)',
          flexShrink: 0,
        }}>
          <CheckCircle2 size={11} /> Resolved
        </span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginTop: '14px', padding: '12px 14px',
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--accent-green-border)',
      }}>
        <Trophy size={20} color="var(--accent-yellow)" />
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Winner</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-green)' }}>
            {market.winnerLabel}
          </div>
        </div>
      </div>

      <button
        onClick={handleShare}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          width: '100%', marginTop: '12px', padding: '10px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text-secondary)',
          fontSize: '12px', fontWeight: 600,
        }}
      >
        <Share2 size={13} /> Share Result
      </button>
    </div>
  );
}

export default function MarketCard({ market }) {
  if (market.status === 'resolved') {
    return <ResolvedMarketCard market={market} />;
  }

  const hasMany = (market.outcomes || []).length > 5;
  return hasMany ? <LargeMarketCard market={market} /> : <SmallMarketCard market={market} />;
}
