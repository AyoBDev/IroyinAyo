'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Sparkles, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { api, cc } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic', 'other',
];

const TITLE_MIN = 10;
const TITLE_MAX = 200;
const OUTCOMES_MIN = 2;
const OUTCOMES_MAX = 10;
const OUTCOME_LABEL_MAX = 60;
const DESCRIPTION_MAX = 500;
const CATEGORY_OTHER_MAX = 30;

const INITIAL = {
  title: '',
  outcomes: ['', ''],
  category: 'scholarships',
  categoryOther: '',
  closesAt: '',
  description: '',
  liquidityB: '',
  isSponsored: false,
  sponsorName: '',
  sponsorLogoUrl: '',
  sponsorFeatured: false,
  advancedOpen: false,
  creating: false,
  generating: false,
  error: '',
  generateError: '',
};

export default function CreateMarketDialog({ open, onClose, onCreated }) {
  const [s, setS] = useState(INITIAL);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!open) setS(INITIAL);
  }, [open]);

  const trimmedTitle = s.title.trim();
  const nonEmptyOutcomes = s.outcomes.map((o) => o.trim()).filter(Boolean);
  const canGenerate =
    !s.generating &&
    trimmedTitle.length >= TITLE_MIN &&
    nonEmptyOutcomes.length >= OUTCOMES_MIN;

  const categoryFinal = s.category === 'other' ? s.categoryOther.trim() : s.category;
  const closesAtDate = s.closesAt ? new Date(s.closesAt) : null;
  const closesAtFuture = closesAtDate && !isNaN(closesAtDate.getTime()) && closesAtDate.getTime() > Date.now();

  const canSubmit =
    !s.creating &&
    trimmedTitle.length >= TITLE_MIN &&
    trimmedTitle.length <= TITLE_MAX &&
    nonEmptyOutcomes.length >= OUTCOMES_MIN &&
    nonEmptyOutcomes.length <= OUTCOMES_MAX &&
    s.outcomes.every((o) => o.trim().length <= OUTCOME_LABEL_MAX) &&
    categoryFinal.length > 0 &&
    (s.category !== 'other' || categoryFinal.length <= CATEGORY_OTHER_MAX) &&
    closesAtFuture &&
    s.description.trim().length > 0 &&
    s.description.trim().length <= DESCRIPTION_MAX &&
    (!s.isSponsored || s.sponsorName.trim().length > 0);

  function updateOutcome(i, value) {
    const next = [...s.outcomes];
    next[i] = value;
    set({ outcomes: next });
  }

  function addOutcome() {
    if (s.outcomes.length >= OUTCOMES_MAX) return;
    set({ outcomes: [...s.outcomes, ''] });
  }

  function removeOutcome(i) {
    if (s.outcomes.length <= OUTCOMES_MIN) return;
    set({ outcomes: s.outcomes.filter((_, j) => j !== i) });
  }

  async function handleGenerate() {
    set({ generating: true, generateError: '' });
    try {
      const res = await cc.describeAIMarket({
        title: trimmedTitle,
        outcomes: nonEmptyOutcomes,
      });
      set({ description: res.description, generating: false, generateError: '' });
    } catch (err) {
      const msg = err.message || 'Failed to generate description.';
      let friendly = msg;
      if (msg === 'rate_limit_exceeded') {
        const retryAfter = err.retryAfter;
        friendly = retryAfter
          ? `AI rate-limited. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
          : 'AI rate-limited. Try again in a minute.';
      }
      else if (msg === 'groq_unavailable' || msg === 'ai_returned_invalid_response') friendly = "AI couldn't draft a description. Type one below.";
      else if (msg === 'groq_not_configured') friendly = 'AI is not configured on the server.';
      set({ generating: false, generateError: friendly });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    set({ creating: true, error: '' });
    try {
      const body = {
        title: trimmedTitle,
        outcomes: nonEmptyOutcomes,
        category: categoryFinal,
        closesAt: closesAtDate.toISOString(),
        description: s.description.trim(),
      };
      if (s.liquidityB && !isNaN(Number(s.liquidityB)) && Number(s.liquidityB) > 0) {
        body.liquidityB = Number(s.liquidityB);
      }
      if (s.isSponsored && s.sponsorName.trim()) {
        body.sponsor = {
          name: s.sponsorName.trim(),
          featured: s.sponsorFeatured,
        };
        if (s.sponsorLogoUrl.trim()) body.sponsor.logoUrl = s.sponsorLogoUrl.trim();
      }
      await api.post('/multi-markets/admin/create', body);
      onCreated();
      onClose();
    } catch (err) {
      set({ error: err.message || 'Failed to create market.', creating: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Prediction Market</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question</label>
            <Input
              value={s.title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={TITLE_MAX}
              placeholder="Who will win the Engineering vs Science match?"
            />
            <div className="text-xs text-muted-foreground mt-1">{trimmedTitle.length}/{TITLE_MAX}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Outcomes ({nonEmptyOutcomes.length}/{OUTCOMES_MAX})</label>
            <div className="space-y-2">
              {s.outcomes.map((outcome, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={outcome}
                    onChange={(e) => updateOutcome(i, e.target.value)}
                    maxLength={OUTCOME_LABEL_MAX}
                    placeholder={`Option ${i + 1}`}
                  />
                  {s.outcomes.length > OUTCOMES_MIN && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeOutcome(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {s.outcomes.length < OUTCOMES_MAX && (
                <Button type="button" variant="outline" size="sm" onClick={addOutcome}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Option
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={s.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {s.category === 'other' && (
                <Input
                  className="mt-2"
                  value={s.categoryOther}
                  onChange={(e) => set({ categoryOther: e.target.value })}
                  maxLength={CATEGORY_OTHER_MAX}
                  placeholder="custom category"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Closes at</label>
              <Input
                type="datetime-local"
                value={s.closesAt}
                onChange={(e) => set({ closesAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
              />
              {s.closesAt && !closesAtFuture && (
                <div className="text-xs text-amber-600 mt-1">Close time must be in the future.</div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">Description</label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {s.generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Generate
              </Button>
            </div>
            <Textarea
              value={s.description}
              onChange={(e) => set({ description: e.target.value })}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              placeholder="1-2 sentences explaining what's being predicted and how it resolves."
            />
            <div className="text-xs text-muted-foreground mt-1">{s.description.trim().length}/{DESCRIPTION_MAX}</div>
            {s.generateError && <div className="text-xs text-red-600 mt-1">{s.generateError}</div>}
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
              onClick={() => set({ advancedOpen: !s.advancedOpen })}
            >
              {s.advancedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Advanced
            </button>
            {s.advancedOpen && (
              <div className="mt-3 space-y-3 pl-4 border-l-2 border-muted">
                <div>
                  <label className="block text-sm font-medium mb-1">Liquidity B override (optional)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={s.liquidityB}
                    onChange={(e) => set({ liquidityB: e.target.value })}
                    placeholder="leave blank for auto"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.isSponsored}
                    onChange={(e) => set({ isSponsored: e.target.checked })}
                    className="rounded"
                  />
                  Sponsored Market
                </label>
                {s.isSponsored && (
                  <div className="space-y-3 pl-4 border-l-2 border-yellow-300">
                    <div>
                      <label className="block text-sm mb-1">Sponsor Name</label>
                      <Input
                        value={s.sponsorName}
                        onChange={(e) => set({ sponsorName: e.target.value })}
                        placeholder="e.g. ChopNow, DataPlug..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Sponsor Logo URL (optional)</label>
                      <Input
                        type="url"
                        value={s.sponsorLogoUrl}
                        onChange={(e) => set({ sponsorLogoUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.sponsorFeatured}
                        onChange={(e) => set({ sponsorFeatured: e.target.checked })}
                        className="rounded"
                      />
                      Featured (pinned to top)
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {s.error && (
            <div className="bg-destructive/15 text-destructive px-3 py-2 rounded text-sm">{s.error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={s.creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {s.creating ? 'Creating...' : 'Create Market'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
