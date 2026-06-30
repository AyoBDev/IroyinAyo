import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { apiFetch } from '../api.js';
import useStore from '../store.js';
// import CreateCrewModal from '../components/CreateCrewModal.jsx'; // TODO: Task 13 will implement this

export default function Crews() {
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const user = useStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/crews')
      .then((data) => { setCrews(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="p-4 text-ink-muted">Loading crews…</div>;

  if (crews.length === 0) {
    return (
      <div className="p-4 max-w-[640px] mx-auto">
        <div className="bg-paper border border-line rounded-2xl p-8 text-center mt-12">
          <Users size={48} className="mx-auto mb-4 text-ink-muted" />
          <h2 className="font-serif text-section mb-2">No crews yet</h2>
          <p className="text-ink-muted text-body-sm mb-6">Create a crew with your friends and predict together.</p>
          <button onClick={() => setShowCreate(true)} className="px-5 py-3 rounded-xl bg-emerald text-white font-medium">
            Create your first crew
          </button>
        </div>
        {/* {showCreate && <CreateCrewModal onClose={() => setShowCreate(false)} onCreated={(crew) => navigate(`/crews/${crew.id}`)} />} */}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[640px] mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-serif text-section">Your Crews</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 rounded-full bg-emerald text-white text-[13px] font-medium">
          <Plus size={14} /> New crew
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {crews.map((c) => (
          <button key={c.id} onClick={() => navigate(`/crews/${c.id}`)} className="bg-paper border border-line rounded-xl p-4 text-left">
            <div className="font-semibold">{c.name}</div>
            <div className="text-[12px] text-ink-muted mt-1">{c.memberCount} member{c.memberCount === 1 ? '' : 's'} · {c.activePoolCount} active pool{c.activePoolCount === 1 ? '' : 's'}</div>
          </button>
        ))}
      </div>
      {/* {showCreate && <CreateCrewModal onClose={() => setShowCreate(false)} onCreated={(crew) => navigate(`/crews/${crew.id}`)} />} */}
    </div>
  );
}
