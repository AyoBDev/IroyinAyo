import { useEffect, useState } from 'react';

const STORAGE_KEY = 'iroyin_deep_link_ref';
const STORAGE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function readFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ref: null, lede: null, market: null };
    const parsed = JSON.parse(raw);
    if (parsed && parsed._ts && Date.now() - parsed._ts < STORAGE_TTL_MS) {
      return { ref: parsed.ref || null, lede: parsed.lede || null, market: parsed.market || null };
    }
    // Expired — clear and ignore.
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  return { ref: null, lede: null, market: null };
}

function writeToStorage(next) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, _ts: Date.now() }));
  } catch {}
}

export function useDeepLinkRef() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { ref: null, lede: null, market: null };
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref) {
      const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
      writeToStorage(next);
      return next;
    }
    return readFromStorage();
  });

  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) {
        const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
        writeToStorage(next);
        setState(next);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return state;
}

export function buildSourceRef({ ref, lede }) {
  if (!ref) return null;
  return lede ? `${ref}:${lede}` : ref;
}
