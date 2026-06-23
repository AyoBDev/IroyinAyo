'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function usePolling(fetchFn, intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchFnRef.current();
      if (!cancelledRef.current) {
        setData(next);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refresh();
    }, intervalMs);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [intervalMs, refresh]);

  return { data, error, loading, refresh };
}
