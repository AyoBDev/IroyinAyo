import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Search, Trophy, Share2, MessageSquare, Users } from 'lucide-react';
import OutcomeRow from './OutcomeRow.jsx';
import PredictSlip from './PredictSlip.jsx';
import PublicChat from './PublicChat.jsx';

const PAGE_SIZE = 10;

function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px',
      padding: '3px 8px', borderRadius: 'var(--radius)',
      background: 'var(--bg-surface-high)', color: 'var(--text-secondary)',
      textTransform: 'uppercase',
    }}>
      {category}
    </span>
  );
}

function TopPercentBadge({ percent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      background: 'var(--primary-bg)', color: 'var(--primary)',
      padding: '4px 10px', borderRadius: 'var(--radius-full)',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 700 }}>{percent}%</span>
    </div>
  );
}

function CardFooter({ market }) {
  const outcomes = market.outcomes || [];
  const totalShares = outcomes.reduce((sum, o) => sum + (o.shares_sold || 0), 0);

  const handleShare = () => {
    const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);
    const topOutcome = sortedOutcomes[0];
    const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;
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
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: '12px', borderTop: '1px solid var(--border)',
      marginTop: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Users size={13} />
          <span style={{ fontSize: '11px', fontWeight: 500 }}>{totalShares}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MessageSquare size={13} />
          <span style={{ fontSize: '11px', fontWeight: 500 }}>{outcomes.length} options</span>
        </div>
      </div>
      <button onClick={handleShare} style={{
        padding: '4px 8px', background: 'var(--bg-surface-container)',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
      }}>
        <Share2 size={12} />
      </button>
    </div>
  );
}

function OutcomeItem({ outcome, isTop, isSelected, onSelect }) {
  const percent = Math.round(outcome.price * 100);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', borderRadius: 'var(--radius-lg)',
        background: isSelected ? 'var(--primary-bg)' : isTop ? 'var(--bg-surface-container)' : 'transparent',
        border: isTop && !isSelected ? '1px solid var(--border)' : isSelected ? '1px solid var(--primary-border)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isTop ? 'var(--primary)' : 'var(--text-tertiary)',
        }} />
        <span style={{
          fontSize: '13px', fontWeight: isTop ? 600 : 400,
          color: isTop ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}>
          {outcome.label}
        </span>
      </div>
      <span style={{
        fontSize: '13px', fontWeight: 700,
        color: isTop ? 'var(--primary)' : 'var(--text-secondary)',
      }}>
        {percent}%
      </span>
    </div>
  );
}

function BinaryOutcomes({ market, outcomes }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const yesOutcome = outcomes.find(o => o.label.toLowerCase().startsWith('yes')) || outcomes[0];
  const noOutcome = outcomes.find(o => o.label.toLowerCase().startsWith('no')) || outcomes[1];

  if (!yesOutcome || !noOutcome) return null;

  const yesPercent = Math.round(yesOutcome.price * 100);
  const noPercent = Math.round(noOutcome.price * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setSelectedOutcome(selectedOutcome === yesOutcome.id ? null : yesOutcome.id)}
          style={{
            flex: 1, padding: '12px',
            borderRadius: 'var(--radius-lg)',
            background: selectedOutcome === yesOutcome.id ? 'var(--accent-green)' : 'var(--accent-green-bg)',
            color: selectedOutcome === yesOutcome.id ? '#fff' : 'var(--accent-green)',
            fontSize: '13px', fontWeight: 600,
            border: `1px solid var(--accent-green-border)`,
            transition: 'all 0.15s ease',
          }}
        >
          Yes {yesPercent}%
        </button>
        <button
          onClick={() => setSelectedOutcome(selectedOutcome === noOutcome.id ? null : noOutcome.id)}
          style={{
            flex: 1, padding: '12px',
            borderRadius: 'var(--radius-lg)',
            background: selectedOutcome === noOutcome.id ? 'var(--accent-red)' : 'var(--accent-red-bg)',
            color: selectedOutcome === noOutcome.id ? '#fff' : 'var(--accent-red)',
            fontSize: '13px', fontWeight: 600,
            border: `1px solid var(--accent-red-border)`,
            transition: 'all 0.15s ease',
          }}
        >
          No {noPercent}%
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

function MultiOutcomes({ market, outcomes }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const sorted = [...outcomes].sort((a, b) => b.price - a.price);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {sorted.map((outcome, index) => (
        <div key={outcome.id}>
          <OutcomeItem
            outcome={outcome}
            isTop={index === 0}
            isSelected={selectedOutcome === outcome.id}
            onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
          />
          {selectedOutcome === outcome.id && (
            <div style={{ padding: '8px 0' }}>
              <PredictSlip market={market} outcome={outcome} onClose={() => setSelectedOutcome(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LargeMarketCard({ market }) {
  const navigate = useNavigate();
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [showChat, setShowChat] = useState(false);

  const sortedOutcomes = [...(market.outcomes || [])].sort((a, b) => b.price - a.price);
  const topOutcome = sortedOutcomes[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;

  const filtered = search
    ? sortedOutcomes.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : sortedOutcomes;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedOutcomes = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: market.is_featured ? '2px solid var(--accent-yellow)' : '1px solid var(--border)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
          <CategoryBadge category={market.category} />
          <TopPercentBadge percent={topPercent} />
        </div>

        <h3
          onClick={() => navigate(`/market/${market.id}`)}
          style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4, marginBottom: '16px', cursor: 'pointer' }}
        >
          {market.title}
        </h3>

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search options..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              width: '100%', padding: '10px 12px 10px 34px', fontSize: '13px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {paginatedOutcomes.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              No results for "{search}"
            </div>
          ) : (
            paginatedOutcomes.map((outcome, index) => (
              <div key={outcome.id}>
                <OutcomeItem
                  outcome={outcome}
                  isTop={index === 0 && page === 0 && !search}
                  isSelected={selectedOutcome === outcome.id}
                  onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
                />
                {selectedOutcome === outcome.id && (
                  <div style={{ padding: '8px 0' }}>
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
            paddingTop: '12px', marginTop: '8px',
          }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: 'var(--radius)',
                background: 'var(--bg-surface-container)', color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                border: '1px solid var(--border)', opacity: page === 0 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: 'var(--radius)',
                background: 'var(--bg-surface-container)', color: page === totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                border: '1px solid var(--border)', opacity: page === totalPages - 1 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}

        <CardFooter market={market} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowChat(!showChat)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            width: '100%', padding: '10px 20px',
            background: showChat ? 'var(--primary-bg)' : 'transparent',
            color: showChat ? 'var(--primary)' : 'var(--text-tertiary)',
            fontSize: '12px', fontWeight: 600,
          }}
        >
          <MessageSquare size={13} /> {showChat ? 'Hide' : 'Show'} Commentary
        </button>
        {showChat && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <PublicChat marketId={market.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function SmallMarketCard({ market }) {
  const navigate = useNavigate();
  const outcomes = market.outcomes || [];
  const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);
  const topOutcome = sortedOutcomes[0];
  const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;

  const isBinary = outcomes.length === 2 &&
    outcomes.some(o => o.label.toLowerCase().startsWith('yes')) &&
    outcomes.some(o => o.label.toLowerCase().startsWith('no'));

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: market.is_featured ? '2px solid var(--accent-yellow)' : '1px solid var(--border)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: 'var(--shadow-md)',
      transition: 'border-color 0.15s ease',
    }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <CategoryBadge category={market.category} />
          <TopPercentBadge percent={topPercent} />
        </div>

        {/* Title */}
        <h3
          onClick={() => navigate(`/market/${market.id}`)}
          style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4, cursor: 'pointer' }}
        >
          {market.title}
        </h3>

        {/* Outcomes */}
        {isBinary ? (
          <BinaryOutcomes market={market} outcomes={outcomes} />
        ) : (
          <MultiOutcomes market={market} outcomes={outcomes} />
        )}

        {/* Footer */}
        <CardFooter market={market} />
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
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--accent-green-border)',
      overflow: 'hidden', position: 'relative',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, var(--accent-green), var(--accent-yellow))',
      }} />

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <CategoryBadge category={market.category} />
          <span style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)',
            background: 'var(--accent-green-bg)', padding: '4px 10px', borderRadius: 'var(--radius-full)',
            display: 'flex', alignItems: 'center', gap: '4px',
            border: '1px solid var(--accent-green-border)',
          }}>
            <CheckCircle2 size={11} /> Resolved
          </span>
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
          {market.title}
        </h3>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px', background: 'var(--accent-green-bg)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-green-border)',
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
            width: '100%', padding: '10px',
            background: 'var(--bg-surface-container)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)',
            fontSize: '12px', fontWeight: 600,
          }}
        >
          <Share2 size={13} /> Share Result
        </button>
      </div>
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
