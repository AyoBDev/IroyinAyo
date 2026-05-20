import { Trophy, X } from 'lucide-react';
import useStore from '../store.js';

export default function ResolutionToast() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);

  if (!toast || toast.type !== 'resolution') return null;

  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, animation: 'slideUp 0.3s ease-out',
      background: 'linear-gradient(135deg, var(--bg-card), var(--accent-green-bg))',
      border: '1px solid var(--accent-green-border)',
      borderRadius: 'var(--radius-xl)', padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 8px 32px rgba(34, 197, 94, 0.2)',
      maxWidth: '360px', width: 'calc(100% - 32px)',
    }}>
      <Trophy size={22} color="var(--accent-yellow)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '2px' }}>
          Market Resolved!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toast.winner} wins "{toast.title}"
        </div>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', padding: '4px' }}>
        <X size={14} />
      </button>
    </div>
  );
}
