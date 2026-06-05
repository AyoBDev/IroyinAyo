import { Plus } from 'lucide-react';
import { getToken } from '../api.js';

export default function CreateMarketFAB({ onClick }) {
  if (!getToken()) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-[88px] right-5 w-14 h-14 rounded-full bg-emerald text-bone flex items-center justify-center z-[100] shadow-float transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
    >
      <Plus size={24} strokeWidth={2.5} />
    </button>
  );
}
