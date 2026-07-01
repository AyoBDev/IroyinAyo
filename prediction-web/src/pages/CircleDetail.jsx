import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, UserPlus } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
import { getSocket } from '../socket.js';
import CirclePoolCard from '../components/CirclePoolCard.jsx';
import CreatePoolModal from '../components/CreatePoolModal.jsx';
import CircleInviteSheet from '../components/CircleInviteSheet.jsx';
import CircleLeaderboardRow from '../components/CircleLeaderboardRow.jsx';

export default function CircleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [activeTab, setActiveTab] = useState('pools');
  const [leaderboard, setLeaderboard] = useState([]);

  async function reload() {
    try {
      const result = await apiFetch(`/api/circles/${id}`);
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

    socket.emit('circle:join', { circleId: id });
    socket.on('circle:pool:prediction', reload);
    socket.on('circle:pool:resolved', reload);

    return () => {
      socket.off('circle:pool:prediction', reload);
      socket.off('circle:pool:resolved', reload);
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
        const { token } = await apiFetch(`/api/circles/${id}/invite`);
        setInviteToken(token);
        setShowInvite(true);
      } catch {}
    }
  }

  async function loadLeaderboard() {
    try {
      const lb = await apiFetch(`/api/circles/${id}/leaderboard`);
      setLeaderboard(lb);
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    }
  }

  useEffect(() => {
    if (activeTab === 'leaderboard' && leaderboard.length === 0) {
      loadLeaderboard();
    }
  }, [activeTab]);

  if (loading) return <div className="p-4 text-ink-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-ink-muted">Circle not found.</div>;

  const { circle, members, pools } = data;
  const isCreator = members.find((m) => m.id === user?.id)?.role === 'creator';
  const open = pools.filter((p) => p.status === 'open');
  const resolving = pools.filter((p) => ['closed', 'awaiting_dispute_window', 'disputed'].includes(p.status));
  const resolved = pools.filter((p) => p.status === 'resolved');

  return (
    <div className="p-4 max-w-[640px] mx-auto">
      <button onClick={() => navigate('/circles')} className="flex items-center gap-1 text-ink-muted text-[13px] mb-3">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="font-serif text-section">{circle.name}</h1>
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

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('pools')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-medium ${activeTab === 'pools' ? 'bg-emerald text-white' : 'bg-paper border border-line text-ink'}`}
        >
          Pools
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-medium ${activeTab === 'leaderboard' ? 'bg-emerald text-white' : 'bg-paper border border-line text-ink'}`}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === 'pools' ? (
        <>
          {open.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Active</h3>
              <div className="flex flex-col gap-2">
                {open.map((p) => <CirclePoolCard key={p.id} pool={p} circleId={id} />)}
              </div>
            </section>
          )}

          {resolving.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Resolving</h3>
              <div className="flex flex-col gap-2">
                {resolving.map((p) => <CirclePoolCard key={p.id} pool={p} circleId={id} />)}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[13px] font-semibold text-ink-muted mb-2">Past pools</h3>
              <div className="flex flex-col gap-2">
                {resolved.slice(0, 10).map((p) => <CirclePoolCard key={p.id} pool={p} circleId={id} />)}
              </div>
            </section>
          )}

          <button
            onClick={() => setShowCreatePool(true)}
            className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-emerald text-white flex items-center justify-center shadow-float-lg"
          >
            <Plus size={24} />
          </button>
        </>
      ) : (
        <section className="mb-5">
          <h3 className="font-serif text-section mb-3">Standings</h3>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-[14px]">
              No predictions yet. Make one to climb the board.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((member, idx) => (
                <CircleLeaderboardRow key={member.student_id} member={member} rank={idx + 1} />
              ))}
            </div>
          )}
        </section>
      )}

      {showCreatePool && <CreatePoolModal circleId={id} onClose={() => setShowCreatePool(false)} onCreated={(pool) => { setShowCreatePool(false); reload(); navigate(`/circles/${id}/pools/${pool.id}`); }} />}
      {showInvite && inviteToken && <CircleInviteSheet circleId={id} inviteToken={inviteToken} isCreator={isCreator} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
