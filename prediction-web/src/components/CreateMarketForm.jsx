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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-card)', borderRadius: '24px 24px 0 0',
        padding: '24px', paddingBottom: '40px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create a Market</h2>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--bg-surface-container)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)',
          }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Question
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to predict?"
              maxLength={150}
              style={{
                width: '100%', padding: '12px 14px', fontSize: '14px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
              {title.trim().length}/150
            </span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Options ({outcomes.length}/10)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {outcomes.map((outcome, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => updateOutcome(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={60}
                    style={{
                      flex: 1, padding: '10px 12px', fontSize: '14px',
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                    }}
                  />
                  {outcomes.length > 2 && (
                    <button type="button" onClick={() => removeOutcome(i)} style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius)',
                      background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-red)',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {outcomes.length < 10 && (
                <button type="button" onClick={addOutcome} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: 'var(--radius)',
                  background: 'var(--bg-surface-container)', border: '1px dashed var(--border)',
                  color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                }}>
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Category (optional)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. sports, entertainment, campus"
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Closes at (optional)
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 'var(--radius)',
              background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-border)',
              color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Cost: 15 pts
            </span>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px', borderRadius: 'var(--radius-xl)',
                background: 'var(--primary)', color: '#fff',
                fontSize: '14px', fontWeight: 600, border: 'none',
                opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
