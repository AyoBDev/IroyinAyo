import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock } from 'lucide-react';
import { apiFetch } from '../api.js';
import RealMoneyComingSoon from './RealMoneyComingSoon.jsx';

export default function CreatePoolModal({ crewId, onClose, onCreated }) {
  const [tab, setTab] = useState('private'); // 'private' | 'public'
  const [title, setTitle] = useState('');
  const [outcomeA, setOutcomeA] = useState('');
  const [outcomeB, setOutcomeB] = useState('');
  const [kickoffAt, setKickoffAt] = useState('');
  const [stakeAmount, setStakeAmount] = useState(50);
  const [currency, setCurrency] = useState('POINTS');
  const [showRealMoney, setShowRealMoney] = useState(false);
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab === 'public') {
      apiFetch('/api/crews/fixtures').then(setFixtures).catch(() => setFixtures([]));
    }
  }, [tab]);

  function selectCurrency(c) {
    if (c === 'NGN') { setShowRealMoney(true); return; }
    setCurrency('POINTS');
  }

  async function handleCreate() {
    setSubmitting(true); setError(null);
    try {
      const payload = tab === 'private'
        ? { poolType: 'private', title: title.trim(), outcomeA: outcomeA.trim(), outcomeB: outcomeB.trim(), kickoffAt, stakeAmount: Number(stakeAmount) }
        : { poolType: 'public', parentMarketId: selectedFixture?.id || null, kickoffAt: selectedFixture?.kickoff_at, stakeAmount: Number(stakeAmount) };
      const { pool } = await apiFetch(`/api/crews/${crewId}/pools`, { method: 'POST', body: JSON.stringify(payload) });
      onCreated(pool);
    } catch (e) {
      setError(e.userMessage || 'Could not create pool.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="bg-paper w-full max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-section">New Pool</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bone flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('private')} className={`flex-1 py-2 rounded-lg text-[13px] font-medium ${tab === 'private' ? 'bg-emerald text-white' : 'bg-paper border border-line text-ink'}`}>Private event</button>
          <button onClick={() => setTab('public')} className={`flex-1 py-2 rounded-lg text-[13px] font-medium ${tab === 'public' ? 'bg-emerald text-white' : 'bg-paper border border-line text-ink'}`}>Public match</button>
        </div>

        {tab === 'private' ? (
          <>
            <label className="text-[12px] text-ink-muted mb-1 block">Question</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tunde vs Wale FIFA tonight" maxLength={200} className="w-full px-3 py-2.5 bg-bone border border-line rounded-lg mb-3" />
            <div className="flex gap-2 mb-3">
              <input type="text" value={outcomeA} onChange={(e) => setOutcomeA(e.target.value)} placeholder="Option A" maxLength={60} className="flex-1 px-3 py-2.5 bg-bone border border-line rounded-lg" />
              <input type="text" value={outcomeB} onChange={(e) => setOutcomeB(e.target.value)} placeholder="Option B" maxLength={60} className="flex-1 px-3 py-2.5 bg-bone border border-line rounded-lg" />
            </div>
          </>
        ) : (
          <>
            <label className="text-[12px] text-ink-muted mb-1 block">Pick a match</label>
            <div className="max-h-40 overflow-y-auto bg-bone border border-line rounded-lg mb-3">
              {fixtures.length === 0
                ? <div className="p-3 text-[12px] text-ink-muted">No upcoming fixtures available.</div>
                : fixtures.map((f) => (
                  <button key={f.id} onClick={() => setSelectedFixture(f)} className={`block w-full text-left p-3 text-[13px] border-b border-line last:border-b-0 ${selectedFixture?.id === f.id ? 'bg-accent-green-bg' : ''}`}>
                    {f.home_team} vs {f.away_team} · {new Date(f.kickoff_at).toLocaleString()}
                  </button>
                ))}
            </div>
          </>
        )}

        <label className="text-[12px] text-ink-muted mb-1 block">Kickoff</label>
        <input type="datetime-local" value={tab === 'public' ? (selectedFixture?.kickoff_at?.slice(0,16) || '') : kickoffAt} onChange={(e) => setKickoffAt(e.target.value)} disabled={tab === 'public'} className="w-full px-3 py-2.5 bg-bone border border-line rounded-lg mb-3" />

        <label className="text-[12px] text-ink-muted mb-1 block">Stake per member (points)</label>
        <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} min={10} max={500} className="w-full px-3 py-2.5 bg-bone border border-line rounded-lg mb-3" />

        <label className="text-[12px] text-ink-muted mb-1 block">Currency</label>
        <div className="flex gap-2 mb-4">
          <button onClick={() => selectCurrency('POINTS')} className={`flex-1 py-2 rounded-lg text-[12px] font-medium ${currency === 'POINTS' ? 'bg-emerald text-white' : 'bg-paper border border-line'}`}>Virtual Points</button>
          <button onClick={() => selectCurrency('NGN')} className="flex-1 py-2 rounded-lg text-[12px] font-medium bg-paper border border-line flex items-center justify-center gap-1 text-ink-muted">
            <Lock size={11} /> Real Money (soon)
          </button>
        </div>

        {error && <div className="text-accent-red text-[12px] mb-2">{error}</div>}
        <button onClick={handleCreate} disabled={submitting} className="w-full py-3 rounded-xl bg-emerald text-white font-medium disabled:opacity-60">
          {submitting ? 'Creating…' : 'Create pool'}
        </button>

        {showRealMoney && <RealMoneyComingSoon source="create_pool_modal" onClose={() => setShowRealMoney(false)} />}
      </div>
    </div>,
    document.body
  );
}
