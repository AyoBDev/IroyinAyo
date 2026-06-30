import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Flag } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import { getSocket } from '../socket.js';

export default function CrewPool() {
  const { id: crewId, poolId } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function reload() {
    try {
      const result = await apiFetch(`/api/crews/pools/${poolId}`);
      setData(result);
      setLoading(false);
    } catch (e) {
      setError(e.userMessage || 'Could not load pool.');
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, [poolId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('crew:join', { crewId });
    socket.on('crew:pool:prediction', reload);
    socket.on('crew:pool:resolved', reload);

    return () => {
      socket.off('crew:pool:prediction', reload);
      socket.off('crew:pool:resolved', reload);
    };
  }, [crewId]);

  async function predict(outcome) {
    setSubmitting(true); setError(null);
    try {
      await apiFetch(`/api/crews/pools/${poolId}/predict`, { method: 'POST', body: JSON.stringify({ outcome }) });
      reload();
    } catch (e) { setError(e.userMessage || 'Could not predict.'); }
    finally { setSubmitting(false); }
  }

  async function reportResult(outcome) {
    if (!confirm(`Report ${outcome} as the winner?`)) return;
    setSubmitting(true); setError(null);
    try {
      await apiFetch(`/api/crews/pools/${poolId}/report-result`, { method: 'POST', body: JSON.stringify({ outcome }) });
      reload();
    } catch (e) { setError(e.userMessage || 'Could not report.'); }
    finally { setSubmitting(false); }
  }

  async function dispute() {
    const reason = prompt('Why are you disputing this result?');
    if (!reason || reason.trim().length < 5) return;
    setSubmitting(true); setError(null);
    try {
      await apiFetch(`/api/crews/pools/${poolId}/dispute`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      reload();
    } catch (e) { setError(e.userMessage || 'Could not dispute.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="p-4 text-ink-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-ink-muted">{error || 'Pool not found.'}</div>;

  const { pool, predictions, currentUserPrediction } = data;
  const isCreator = pool.creator_id === user?.id;
  const isPrivate = pool.pool_type === 'private';
  const optionA = isPrivate ? pool.outcome_a_label : 'Home';
  const optionB = isPrivate ? pool.outcome_b_label : 'Away';

  return (
    <div className="p-4 max-w-[640px] mx-auto">
      <button onClick={() => navigate(`/crews/${crewId}`)} className="flex items-center gap-1 text-ink-muted text-[13px] mb-3">
        <ArrowLeft size={16} /> Back to crew
      </button>

      <h1 className="font-serif text-section mb-2">{pool.title || 'Match prediction'}</h1>
      <div className="text-[12px] text-ink-muted mb-4 flex items-center gap-1">
        <Clock size={12} /> Kickoff: {new Date(pool.kickoff_at).toLocaleString()}
      </div>

      <div className="bg-paper border border-line rounded-xl p-4 mb-4">
        <div className="text-[12px] text-ink-muted mb-3">Stake: {pool.stake_amount} pts · {predictions.length} predictors</div>

        {pool.status === 'open' && !currentUserPrediction && (
          <div className="flex gap-2">
            <button onClick={() => predict(optionA)} disabled={submitting} className="flex-1 py-3 rounded-xl bg-accent-green-bg border border-accent-green-border text-accent-green font-semibold disabled:opacity-60">
              {optionA}
            </button>
            <button onClick={() => predict(optionB)} disabled={submitting} className="flex-1 py-3 rounded-xl bg-accent-red-bg border border-accent-red-border text-accent-red font-semibold disabled:opacity-60">
              {optionB}
            </button>
          </div>
        )}

        {currentUserPrediction && (
          <div className="bg-accent-green-bg border border-accent-green-border rounded-lg px-3 py-2 text-[13px] text-accent-green">
            You picked: <span className="font-bold">{currentUserPrediction.predicted_outcome}</span>
          </div>
        )}

        {pool.status === 'closed' && isCreator && isPrivate && (
          <div className="mt-3">
            <div className="text-[12px] text-ink-muted mb-2">Report the winner:</div>
            <div className="flex gap-2">
              <button onClick={() => reportResult(optionA)} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-paper border border-line text-[13px] font-semibold">
                {optionA} won
              </button>
              <button onClick={() => reportResult(optionB)} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-paper border border-line text-[13px] font-semibold">
                {optionB} won
              </button>
            </div>
          </div>
        )}

        {pool.status === 'awaiting_dispute_window' && !isCreator && (
          <button onClick={dispute} disabled={submitting} className="mt-3 w-full py-2.5 rounded-xl bg-paper border border-line text-accent-red text-[13px] font-semibold flex items-center justify-center gap-1">
            <Flag size={13} /> Dispute result
          </button>
        )}

        {pool.status === 'resolved' && pool.winner_outcome && (
          <div className="mt-3 bg-accent-green-bg border border-accent-green-border rounded-lg px-3 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-accent-green" />
            <div className="text-[13px]"><span className="font-bold">{pool.winner_outcome}</span> won.{' '}
              {currentUserPrediction?.payout > 0 ? `You earned ${currentUserPrediction.payout} pts.` : 'Better luck next time.'}
            </div>
          </div>
        )}

        {pool.status === 'disputed' && (
          <div className="mt-3 bg-accent-red-bg border border-accent-red-border rounded-lg px-3 py-2 text-[13px] text-accent-red flex items-center gap-2">
            <AlertCircle size={14} /> This pool is being reviewed.
          </div>
        )}

        {error && <div className="mt-3 text-accent-red text-[12px]">{error}</div>}
      </div>

      <section>
        <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Predictors ({predictions.length})</h3>
        <div className="bg-paper border border-line rounded-xl divide-y divide-line">
          {predictions.map((p) => (
            <div key={p.id} className="flex justify-between items-center px-3 py-2 text-[13px]">
              <div>{p.name || 'Anonymous'}</div>
              <div className="text-ink-muted">{p.predicted_outcome || 'predicted'}</div>
            </div>
          ))}
          {predictions.length === 0 && <div className="p-3 text-[12px] text-ink-muted">No predictions yet.</div>}
        </div>
      </section>
    </div>
  );
}
