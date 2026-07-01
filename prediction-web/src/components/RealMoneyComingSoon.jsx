import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins } from 'lucide-react';
import { apiFetch } from '../api.js';

export default function RealMoneyComingSoon({ source, onClose }) {
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin() {
    setSubmitting(true);
    try {
      await apiFetch('/api/circles/realmoney-waitlist', { method: 'POST', body: JSON.stringify({ source }) });
      setJoined(true);
    } catch (e) {
      setError(e.userMessage || 'Could not save. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="bg-paper w-full max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-section flex items-center gap-2"><Coins size={20} /> Real Money — Coming Soon</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bone flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-ink-muted mb-5">Real money pools aren't available yet. We're working on the legal framework.</p>
        {joined ? (
          <div className="text-accent-green text-[13px] font-semibold">We'll let you know when it launches.</div>
        ) : (
          <>
            {error && <div className="text-accent-red text-[12px] mb-2">{error}</div>}
            <button onClick={handleJoin} disabled={submitting} className="w-full py-3 rounded-xl bg-emerald text-white font-medium disabled:opacity-60">
              {submitting ? 'Saving…' : 'Notify me when this launches'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
