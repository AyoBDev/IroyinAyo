import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiFetch } from '../api.js';

export default function CreateCircleModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    if (name.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { circle, inviteToken } = await apiFetch('/api/circles', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      onCreated(circle, inviteToken);
    } catch (e) {
      setError(e.userMessage || e.message || 'Could not create circle.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="bg-paper w-full max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-section">Create a Circle</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bone flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-ink-muted mb-4">A circle is up to 15 friends who predict together. Give it a name your group will recognize.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Block A FIFA Boys"
          className="w-full px-3 py-3 bg-bone border border-line rounded-lg text-ink mb-3"
          autoFocus
        />
        {error && <div className="text-accent-red text-[12px] mb-2">{error}</div>}
        <button
          onClick={handleCreate}
          disabled={submitting || name.trim().length === 0}
          className="w-full py-3 rounded-xl bg-emerald text-white font-medium disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create circle'}
        </button>
      </div>
    </div>,
    document.body
  );
}
