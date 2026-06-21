import { Link } from 'react-router-dom';

export default function MarketsTopStrip({ markets, title = 'Markets you might call' }) {
  if (!markets || markets.length === 0) return null;
  return (
    <section className="px-4 pt-4 pb-2">
      <h2 className="font-serif text-section mb-2">{title}</h2>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x">
        {markets.map((m) => (
          <Link
            key={m.marketId}
            to={`/market/${m.marketId}?ref=wa_daily&lede=rank-strip`}
            className="snap-start min-w-[240px] bg-paper border border-line rounded-2xl p-4"
          >
            <div className="font-sans label">{m.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
