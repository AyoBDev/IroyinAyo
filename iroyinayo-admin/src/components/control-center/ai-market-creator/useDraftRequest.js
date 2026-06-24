'use client';
import { useState, useRef, useCallback } from 'react';
import { cc } from '@/lib/api';

const INITIAL_STATE = 'idle';

export function useDraftRequest() {
  const [state, setState] = useState(INITIAL_STATE);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [originalDraft, setOriginalDraft] = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setState('idle');
    setDraft(null);
    setError(null);
    setLatencyMs(null);
    setOriginalDraft(null);
    abortRef.current = null;
  }, []);

  const generate = useCallback(async (prompt) => {
    abortRef.current = new AbortController();
    setState('drafting');
    setError(null);
    setDraft(null);
    try {
      const result = await cc.getAIMarketDraft(prompt, { signal: abortRef.current.signal });
      const { model, latencyMs: lm, ...rest } = result;
      setDraft(rest);
      setOriginalDraft(rest);
      setLatencyMs(lm);
      setState('preview');
    } catch (err) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
        setState('idle');
        return;
      }
      setError(err.message || 'Failed to generate draft');
      setState('error');
    } finally {
      abortRef.current = null;
    }
  }, []);

  const edit = useCallback((field, value) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }, []);

  const publish = useCallback(async () => {
    if (!draft) return null;
    setState('publishing');
    setError(null);
    try {
      const result = await cc.publishAIMarket(draft);
      reset();
      return result;
    } catch (err) {
      setError(err.message || 'Failed to publish');
      setState('preview');
      return null;
    }
  }, [draft, reset]);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    reset();
  }, [reset]);

  const discard = useCallback(() => {
    reset();
  }, [reset]);

  const fieldsEdited = useCallback(() => {
    if (!draft || !originalDraft) return [];
    const changed = [];
    for (const key of Object.keys(draft)) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(originalDraft[key])) {
        changed.push(key);
      }
    }
    return changed;
  }, [draft, originalDraft]);

  return { state, draft, error, latencyMs, generate, edit, publish, cancel, discard, fieldsEdited };
}
