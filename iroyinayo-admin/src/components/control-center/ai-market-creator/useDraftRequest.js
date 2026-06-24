'use client';
import { useState, useRef, useCallback } from 'react';
import { cc } from '@/lib/api';
import { track } from '@/lib/telemetry';

const INITIAL_STATE = 'idle';

export function useDraftRequest() {
  const [state, setState] = useState(INITIAL_STATE);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [originalDraft, setOriginalDraft] = useState(null);
  const abortRef = useRef(null);
  const discardStartRef = useRef(null);

  const reset = useCallback(() => {
    setState('idle');
    setDraft(null);
    setError(null);
    setLatencyMs(null);
    setOriginalDraft(null);
    abortRef.current = null;
  }, []);

  const generate = useCallback(async (prompt, opts = {}) => {
    abortRef.current = new AbortController();
    setState('drafting');
    setError(null);
    setDraft(null);
    const startedAt = Date.now();
    track('cc_ai_draft_requested', { prompt_length: prompt.length, seeded_from_trend: !!opts.seededFromTrend });
    try {
      const result = await cc.getAIMarketDraft(prompt, { signal: abortRef.current.signal });
      const { model, latencyMs: lm, ...rest } = result;
      setDraft(rest);
      setOriginalDraft(rest);
      setLatencyMs(lm);
      setState('preview');
      discardStartRef.current = Date.now();
      track('cc_ai_draft_received', { latency_ms: lm || (Date.now() - startedAt), outcome_count: rest.outcomes?.length || 0, category: rest.category });
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

  const publish = useCallback(async () => {
    if (!draft) return null;
    setState('publishing');
    setError(null);
    const edited = fieldsEdited();
    try {
      const result = await cc.publishAIMarket(draft);
      track('cc_ai_draft_published', { market_id: result.marketId, category: draft.category, outcome_count: draft.outcomes.length, fields_edited: edited });
      reset();
      return result;
    } catch (err) {
      setError(err.message || 'Failed to publish');
      setState('preview');
      return null;
    }
  }, [draft, reset, fieldsEdited]);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    reset();
  }, [reset]);

  const discard = useCallback(() => {
    if (state === 'preview' && discardStartRef.current) {
      track('cc_ai_draft_discarded', { time_in_preview_seconds: Math.round((Date.now() - discardStartRef.current) / 1000) });
    }
    reset();
  }, [reset, state]);

  return { state, draft, error, latencyMs, generate, edit, publish, cancel, discard, fieldsEdited };
}
