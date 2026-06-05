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
    <span className="font-mono text-mono-label uppercase tracking-[1.76px] px-2 py-0.5 rounded-md bg-paper border border-line text-ink-muted">
      {category}
    </span>
  );
}

function TopPercentBadge({ percent }) {
  return (
    <div className="flex items-center gap-0.5 bg-accent-green-bg text-accent-green px-2.5 py-1 rounded-full">
      <span className="text-[12px] font-bold">{percent}%</span>
    </div>
  );
}

function CardFooter({ market }) {
  const outcomes = market.outcomes || [];
  const participantCount = market.participant_count || 0;

  const handleShare = () => {
    const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);
    const topOutcome = sortedOutcomes[0];
    const topPercent = topOutcome ? Math.round(topOutcome.price * 100) : 0;
    const shareUrl = `${window.location.origin}/market/${market.id}`;
    const text = `${topOutcome?.label} leads at ${topPercent}% — "${market.title}" on IroyinMarket`;
    if (navigator.share) {
      navigator.share({ text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
    }
  };

  return (
    <div className="flex justify-between items-center pt-3 border-t border-line mt-1">
      <div className="flex items-center gap-3 text-ink-muted">
        <div className="flex items-center gap-1">
          <Users size={13} />
          <span className="text-[11px] font-medium">
            {participantCount} predictor{participantCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare size={13} />
          <span className="text-[11px] font-medium">{outcomes.length} options</span>
        </div>
      </div>
      <button onClick={handleShare} className="p-1 px-2 bg-paper rounded-md border border-line text-ink-muted hover:bg-paper-hover transition-colors flex items-center">
        <Share2 size={12} />
      </button>
    </div>
  );
}

function OutcomeItem({ outcome, isTop, isSelected, onSelect }) {
  const percent = Math.round(outcome.price * 100);

  const wrapperClasses = [
    'flex justify-between items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all',
    isSelected
      ? 'bg-accent-green-bg border border-accent-green-border'
      : isTop
        ? 'bg-paper border border-line'
        : 'bg-transparent border border-transparent',
  ].join(' ');

  return (
    <div onClick={onSelect} className={wrapperClasses}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isTop ? 'bg-emerald' : 'bg-ink-muted'}`} />
        <span className={`text-[13px] ${isTop ? 'font-semibold text-ink' : 'font-normal text-ink-muted'}`}>
          {outcome.label}
        </span>
      </div>
      <span className={`text-[13px] font-bold ${isTop ? 'text-emerald' : 'text-ink-muted'}`}>
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

  const yesSelected = selectedOutcome === yesOutcome.id;
  const noSelected = selectedOutcome === noOutcome.id;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedOutcome(yesSelected ? null : yesOutcome.id)}
          className={[
            'flex-1 p-3 rounded-lg text-[13px] font-semibold border transition-all',
            yesSelected
              ? 'bg-accent-green text-white border-accent-green'
              : 'bg-accent-green-bg text-accent-green border-accent-green-border',
          ].join(' ')}
        >
          Yes {yesPercent}%
        </button>
        <button
          onClick={() => setSelectedOutcome(noSelected ? null : noOutcome.id)}
          className={[
            'flex-1 p-3 rounded-lg text-[13px] font-semibold border transition-all',
            noSelected
              ? 'bg-accent-red text-white border-accent-red'
              : 'bg-accent-red-bg text-accent-red border-accent-red-border',
          ].join(' ')}
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
    <div className="flex flex-col gap-1">
      {sorted.map((outcome, index) => (
        <div key={outcome.id}>
          <OutcomeItem
            outcome={outcome}
            isTop={index === 0}
            isSelected={selectedOutcome === outcome.id}
            onSelect={() => setSelectedOutcome(selectedOutcome === outcome.id ? null : outcome.id)}
          />
          {selectedOutcome === outcome.id && (
            <div className="py-2">
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
    <div className={[
      'bg-paper rounded-2xl overflow-hidden flex flex-col border',
      market.is_featured ? 'border-2 border-accent-yellow' : 'border-line',
    ].join(' ')}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <CategoryBadge category={market.category} />
          <TopPercentBadge percent={topPercent} />
        </div>

        <h3
          onClick={() => navigate(`/market/${market.id}`)}
          className="font-serif text-section leading-tight cursor-pointer hover:text-emerald transition-colors mb-4"
        >
          {market.title}
        </h3>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search options..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full py-2.5 pl-8 pr-3 text-body-sm bg-bone border border-line rounded-lg text-ink placeholder:text-ink-muted"
          />
        </div>

        <div className="flex flex-col gap-1">
          {paginatedOutcomes.length === 0 ? (
            <div className="p-5 text-center text-ink-muted text-[13px]">
              No results for &ldquo;{search}&rdquo;
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
                  <div className="py-2">
                    <PredictSlip market={market} outcome={outcome} onClose={() => setSelectedOutcome(null)} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-3 mt-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-paper border border-line text-ink disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-[12px] text-ink-muted font-medium">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-paper border border-line text-ink disabled:opacity-40 flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}

        <CardFooter market={market} />
      </div>

      <div className="border-t border-line">
        <button
          onClick={() => setShowChat(!showChat)}
          className={[
            'flex items-center gap-1.5 w-full px-5 py-2.5 text-[12px] font-semibold',
            showChat ? 'bg-accent-green-bg text-emerald' : 'bg-transparent text-ink-muted',
          ].join(' ')}
        >
          <MessageSquare size={13} /> {showChat ? 'Hide' : 'Show'} Commentary
        </button>
        {showChat && (
          <div className="border-t border-line">
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
    <div className={[
      'bg-paper rounded-2xl overflow-hidden flex flex-col border transition-colors',
      market.is_featured ? 'border-2 border-accent-yellow' : 'border-line',
    ].join(' ')}>
      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <CategoryBadge category={market.category} />
          <TopPercentBadge percent={topPercent} />
        </div>

        {/* Title */}
        <h3
          onClick={() => navigate(`/market/${market.id}`)}
          className="font-serif text-section leading-tight cursor-pointer hover:text-emerald transition-colors"
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
    const shareUrl = `${window.location.origin}/market/${market.id}`;
    const text = `${market.winnerLabel} won "${market.title}" on IroyinMarket!`;
    if (navigator.share) {
      navigator.share({ text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
    }
  };

  return (
    <div className="bg-paper rounded-2xl border border-accent-green-border overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent-green to-accent-yellow" />

      <div className="p-5 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <CategoryBadge category={market.category} />
          <span className="text-[11px] font-bold text-accent-green bg-accent-green-bg px-2.5 py-1 rounded-full flex items-center gap-1 border border-accent-green-border">
            <CheckCircle2 size={11} /> Resolved
          </span>
        </div>

        <h3 className="font-serif text-section leading-tight text-ink-muted">
          {market.title}
        </h3>

        <div className="flex items-center gap-2.5 p-3.5 bg-accent-green-bg rounded-lg border border-accent-green-border">
          <Trophy size={20} className="text-accent-yellow" />
          <div>
            <div className="text-[11px] text-ink-muted mb-0.5">Winner</div>
            <div className="text-[15px] font-bold text-accent-green">
              {market.winnerLabel}
            </div>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-paper border border-line rounded-lg text-ink-muted text-[12px] font-semibold hover:bg-paper-hover transition-colors"
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
