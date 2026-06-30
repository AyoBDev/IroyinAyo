import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, UserPlus } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import { getSocket } from '../socket.js';
import CrewPoolCard from '../components/CrewPoolCard.jsx';
import CreatePoolModal from '../components/CreatePoolModal.jsx';
import CrewInviteSheet from '../components/CrewInviteSheet.jsx';

export default function CrewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);

  async function reload() {
    try {
      const result = await apiFetch(`/api/crews/${id}`);
      setData(result);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('crew:join', { crewId: id });
    socket.on('crew:pool:prediction', reload);
    socket.on('crew:pool:resolved', reload);

    return () => {
      socket.off('crew:pool:prediction', reload);
      socket.off('crew:pool:resolved', reload);
    };
  }, [id]);

  async function openInvite() {
    // Fetch the existing active invite token. Opening the sheet must NOT
    // rotate the token — that would invalidate any link the creator already
    // shared. Rotation is an explicit action inside the sheet.
    if (!data) return;
    const isCreator = data.members.find((m) => m.id === user?.id)?.role === 'creator';
    if (isCreator) {
      try {
        const { token } = await apiFetch(`/api/crews/${id}/invite`);
        setInviteToken(token);
        setShowInvite(true);
      } catch {}
    }
  }

  if (loading) return <div className="p-4 text-ink-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-ink-muted">Crew not found.</div>;

  const { crew, members, pools } = data;
  const isCreator = members.find((m) => m.id === user?.id)?.role === 'creator';
  const open = pools.filter((p) => p.status === 'open');
  const resolving = pools.filter((p) => ['closed', 'awaiting_dispute_window', 'disputed'].includes(p.status));
  const resolved = pools.filter((p) => p.status === 'resolved');

  return (
    <div className="p-4 max-w-[640px] mx-auto">
      <button onClick={() => navigate('/crews')} className="flex items-center gap-1 text-ink-muted text-[13px] mb-3">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="font-serif text-section">{crew.name}</h1>
          <div className="text-[12px] text-ink-muted mt-1 flex items-center gap-1">
            <Users size={12} /> {members.length} member{members.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex gap-2">
          {isCreator && (
            <button onClick={openInvite} className="flex items-center gap-1 px-3 py-2 rounded-full bg-paper border border-line text-[12px]">
              <UserPlus size={12} /> Invite
            </button>
          )}
        </div>
      </div>

      {open.length > 0 && (
        <section className="mb-5">
          <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Active</h3>
          <div className="flex flex-col gap-2">
            {open.map((p) => <CrewPoolCard key={p.id} pool={p} crewId={id} />)}
          </div>
        </section>
      )}

      {resolving.length > 0 && (
        <section className="mb-5">
          <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Resolving</h3>
          <div className="flex flex-col gap-2">
            {resolving.map((p) => <CrewPoolCard key={p.id} pool={p} crewId={id} />)}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="mb-5">
          <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Past pools</h3>
          <div className="flex flex-col gap-2">
            {resolved.slice(0, 10).map((p) => <CrewPoolCard key={p.id} pool={p} crewId={id} />)}
          </div>
        </section>
      )}

      <button
        onClick={() => setShowCreatePool(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-emerald text-white flex items-center justify-center shadow-float-lg"
      >
        <Plus size={24} />
      </button>

      {showCreatePool && <CreatePoolModal crewId={id} onClose={() => setShowCreatePool(false)} onCreated={(pool) => { setShowCreatePool(false); reload(); navigate(`/crews/${id}/pools/${pool.id}`); }} />}
      {showInvite && inviteToken && <CrewInviteSheet crewId={id} inviteToken={inviteToken} isCreator={isCreator} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
