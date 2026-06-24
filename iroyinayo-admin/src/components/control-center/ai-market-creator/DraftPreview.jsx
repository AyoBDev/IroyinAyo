'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { OutcomeInputs } from './OutcomeInputs';

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];

function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DraftPreview({ draft, onChange, onPublish, onDiscard, error }) {
  const [publishing, setPublishing] = useState(false);
  const closesAtLocal = toLocalDatetime(draft.closesAt);
  const closesAtDate = new Date(draft.closesAt);
  const closesPastWarning = !isNaN(closesAtDate.getTime()) && closesAtDate.getTime() < Date.now();

  const canPublish =
    !publishing &&
    typeof draft.title === 'string' &&
    draft.title.trim().length >= 10 &&
    draft.title.trim().length <= 200 &&
    Array.isArray(draft.outcomes) &&
    draft.outcomes.length >= 2 &&
    draft.outcomes.length <= 4 &&
    draft.outcomes.every((o) => o.trim().length > 0 && o.trim().length <= 60) &&
    CATEGORIES.includes(draft.category) &&
    closesAtLocal &&
    !closesPastWarning;

  async function handlePublish() {
    setPublishing(true);
    try { await onPublish(); }
    finally { setPublishing(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input value={draft.title} onChange={(e) => onChange('title', e.target.value)} maxLength={200} />
      </div>

      <OutcomeInputs outcomes={draft.outcomes} onChange={(v) => onChange('outcomes', v)} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">Category</label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={draft.category}
            onChange={(e) => onChange('category', e.target.value)}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Closes at</label>
          <Input
            type="datetime-local"
            value={closesAtLocal}
            onChange={(e) => {
              const d = new Date(e.target.value);
              onChange('closesAt', isNaN(d.getTime()) ? '' : d.toISOString());
            }}
          />
        </div>
      </div>
      {closesPastWarning && <div className="text-xs text-amber-600">Close time is in the past — adjust before publishing.</div>}

      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={draft.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handlePublish} disabled={!canPublish}>
          {publishing ? 'Publishing…' : 'Publish'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={publishing}>Discard</Button>
      </div>
    </div>
  );
}
