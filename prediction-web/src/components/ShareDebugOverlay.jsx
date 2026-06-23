import { useEffect, useState } from 'react';

export default function ShareDebugOverlay() {
  const [lines, setLines] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    function onEvt(e) {
      setLines((ls) => [...ls, `${new Date().toISOString().slice(11, 23)} ${e.detail}`].slice(-30));
      setOpen(true);
    }
    window.addEventListener('share-debug', onEvt);
    return () => window.removeEventListener('share-debug', onEvt);
  }, []);

  if (lines.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-2 left-2 z-[100000] bg-black/80 text-white text-[10px] px-2 py-1 rounded"
      >
        debug ({lines.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-2 left-2 right-2 z-[100000] bg-black/90 text-green-300 text-[10px] font-mono p-2 rounded max-h-[40vh] overflow-y-auto">
      <div className="flex justify-between mb-1 text-white">
        <span>share-debug</span>
        <span>
          <button onClick={() => setLines([])} className="mr-2 text-white">clear</button>
          <button onClick={() => setOpen(false)} className="text-white">hide</button>
        </span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="break-words">{l}</div>
      ))}
    </div>
  );
}
