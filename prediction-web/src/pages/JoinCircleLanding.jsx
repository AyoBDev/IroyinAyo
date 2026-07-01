import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';

export default function JoinCircleLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const openAuthModal = useStore((s) => s.openAuthModal);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/circles/invites/${token}/preview`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body.error;
        setPreview(body); setLoading(false);
      })
      .catch((e) => {
        setError(e?.userMessage || 'This invite link doesn\'t work.');
        setLoading(false);
      });
  }, [token]);

  async function handleJoin() {
    if (!user) { openAuthModal(); return; }
    setJoining(true);
    try {
      await apiFetch(`/api/circles/invites/${token}/join`, { method: 'POST' });
      navigate(`/circles/${preview.circleId}`);
    } catch (e) {
      setError(e.userMessage || 'Could not join.');
      setJoining(false);
    }
  }

  if (loading) return <div className="p-4 text-ink-muted">Loading invite…</div>;
  if (error) return (
    <div className="p-4 max-w-[420px] mx-auto text-center mt-12">
      <div className="text-accent-red font-semibold mb-3">{error}</div>
      <button onClick={() => navigate('/circles')} className="px-4 py-2 rounded-lg bg-paper border border-line text-[13px]">Go to my circles</button>
    </div>
  );

  return (
    <div className="p-4 max-w-[420px] mx-auto text-center mt-12">
      <Users size={48} className="mx-auto mb-4 text-emerald" />
      <h1 className="font-serif text-section mb-2">Join {preview.crewName}</h1>
      <p className="text-[13px] text-ink-muted mb-6">{preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} in this circle{preview.isFull ? ' — it\'s currently full.' : '.'}</p>
      <button onClick={handleJoin} disabled={joining || preview.isFull} className="w-full py-3 rounded-xl bg-emerald text-white font-medium disabled:opacity-60">
        {joining ? 'Joining…' : preview.isFull ? 'Circle is full' : (user ? 'Join circle' : 'Sign in to join')}
      </button>
    </div>
  );
}
