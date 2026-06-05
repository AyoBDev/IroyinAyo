import { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import { useNavigate } from 'react-router-dom';

export default function CreateMarketForm({ onClose }) {
  const [title, setTitle] = useState('');
  const [outcomes, setOutcomes] = useState(['', '']);
  const [category, setCategory] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fetchMarkets = useStore((s) => s.fetchMarkets);
  const fetchUser = useStore((s) => s.fetchUser);

  function addOutcome() {
    if (outcomes.length >= 10) return;
    setOutcomes([...outcomes, '']);
  }

  function removeOutcome(index) {
    if (outcomes.length <= 2) return;
    setOutcomes(outcomes.filter((_, i) => i !== index));
  }

  function updateOutcome(index, value) {
    const updated = [...outcomes];
    updated[index] = value;
    setOutcomes(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedOutcomes = outcomes.map(o => o.trim()).filter(Boolean);
    if (!title.trim() || title.trim().length < 10) {
      setError('Title must be at least 10 characters');
      return;
    }
    if (trimmedOutcomes.length < 2) {
      setError('Add at least 2 outcomes');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        title: title.trim(),
        outcomes: trimmedOutcomes,
      };
      if (category.trim()) body.category = category.trim();
      if (closesAt) body.closesAt = new Date(closesAt).toISOString();

      const market = await apiFetch('/api/multi-markets/create', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      fetchMarkets();
      fetchUser();
      onClose();
      navigate(`/market/${market.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-paper rounded-t-3xl p-6 pb-10 shadow-float">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-serif text-lg text-ink">Create a Market</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-paper border border-line flex items-center justify-center text-ink-muted">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">
              Question
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to predict?"
              maxLength={150}
              className="w-full py-3 px-3.5 text-sm bg-bone border border-line rounded-lg text-ink placeholder:text-ink-muted"
            />
            <span className="text-[11px] text-ink-muted mt-1 block font-mono">
              {title.trim().length}/150
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">
              Options ({outcomes.length}/10)
            </label>
            <div className="flex flex-col gap-2">
              {outcomes.map((outcome, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => updateOutcome(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={60}
                    className="flex-1 py-2.5 px-3 text-sm bg-bone border border-line rounded-md text-ink placeholder:text-ink-muted"
                  />
                  {outcomes.length > 2 && (
                    <button type="button" onClick={() => removeOutcome(i)} className="w-8 h-8 rounded-md bg-accent-red-bg border border-accent-red-border flex items-center justify-center text-accent-red">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {outcomes.length < 10 && (
                <button type="button" onClick={addOutcome} className="flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-paper border border-dashed border-line text-ink-muted text-[13px] font-medium">
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">
              Category (optional)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. sports, entertainment, campus"
              className="w-full py-2.5 px-3 text-sm bg-bone border border-line rounded-md text-ink placeholder:text-ink-muted"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">
              Closes at (optional)
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full py-2.5 px-3 text-sm bg-bone border border-line rounded-md text-ink"
            />
          </div>

          {error && (
            <div className="py-2.5 px-3 rounded-md bg-accent-red-bg border border-accent-red-border text-accent-red text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-ink-muted font-mono font-semibold">
              Cost: 15 pts
            </span>
            <button
              type="submit"
              disabled={loading}
              className={`py-3 px-6 rounded-2xl bg-emerald text-bone text-sm font-semibold flex items-center gap-2 ${loading ? 'opacity-60' : 'hover:bg-emerald-deep'}`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
