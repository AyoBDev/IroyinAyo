'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

export function OutcomeInputs({ outcomes, onChange }) {
  const setAt = (idx, value) => {
    const next = [...outcomes];
    next[idx] = value;
    onChange(next);
  };
  const remove = (idx) => {
    if (outcomes.length <= 2) return;
    const next = outcomes.filter((_, i) => i !== idx);
    onChange(next);
  };
  const add = () => {
    if (outcomes.length >= 4) return;
    onChange([...outcomes, '']);
  };
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Outcomes ({outcomes.length})</div>
      {outcomes.map((o, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            value={o}
            onChange={(e) => setAt(idx, e.target.value)}
            maxLength={60}
            placeholder={`Outcome ${idx + 1}`}
          />
          <Button size="sm" variant="ghost" disabled={outcomes.length <= 2} onClick={() => remove(idx)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {outcomes.length < 4 && (
        <Button size="sm" variant="secondary" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Add outcome
        </Button>
      )}
    </div>
  );
}
