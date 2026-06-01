import { Plus } from 'lucide-react';
import { getToken } from '../api.js';

export default function CreateMarketFAB({ onClick }) {
  if (!getToken()) return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '88px',
        right: '20px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'var(--primary)',
        color: '#fff',
        border: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        transition: 'transform 0.15s ease',
      }}
    >
      <Plus size={24} strokeWidth={2.5} />
    </button>
  );
}
