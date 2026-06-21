import { useEffect, useState } from 'react';

const STORAGE_KEY = 'iroyin_deep_link_ref';

export function useDeepLinkRef() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { ref: null, lede: null, market: null };
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref) {
      const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { ref: null, lede: null, market: null };
  });

  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) {
        const next = { ref, lede: url.searchParams.get('lede'), market: url.searchParams.get('market') };
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
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
