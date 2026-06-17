import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import PredictionCard from '../components/PredictionCard.jsx';

export default function SharePrediction() {
  const { positionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/multi-markets/positions/${positionId}/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [positionId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={24} className="text-emerald animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-ink-muted text-body-sm mb-4">Prediction not found</p>
        <Link to="/" className="text-emerald text-[13px] font-semibold">
          Go to Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <PredictionCard
        marketTitle={data.marketTitle}
        outcomeLabel={data.outcomeLabel}
        probability={data.probability}
        amount={data.amount}
        potentialPayout={data.potentialPayout}
        username={data.username}
        timestamp={data.timestamp}
      />

      <div className="w-full max-w-[360px] mt-5">
        <Link
          to={`/market/${data.marketId}`}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald rounded-xl text-bone text-label-sm font-semibold no-underline hover:bg-emerald-deep transition-colors"
        >
          Make your own prediction <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
