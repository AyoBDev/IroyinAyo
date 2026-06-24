'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function PromptInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 5;
  const canSubmit = trimmed.length >= 5 && trimmed.length <= 500 && !disabled;
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What's trending? e.g., UNILAG vs OAU Saturday, BBNaija eviction tonight"
        maxLength={500}
        rows={3}
        disabled={disabled}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{trimmed.length}/500</span>
        <Button size="sm" disabled={!canSubmit} onClick={() => onSubmit(trimmed)}>
          Draft with AI
        </Button>
      </div>
      {tooShort && <div className="text-xs text-red-600">Prompt must be at least 5 characters.</div>}
    </div>
  );
}
