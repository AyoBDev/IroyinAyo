'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { useDraftRequest } from './useDraftRequest';
import { PromptInput } from './PromptInput';
import { DraftPreview } from './DraftPreview';
import { TrendsSection } from './TrendsSection';

export function AIMarketCreatorPanel() {
  const { state, draft, error, generate, edit, publish, cancel, discard } = useDraftRequest();
  const drafting = state === 'drafting';
  const previewing = state === 'preview' || state === 'publishing';

  async function handlePublish() {
    const result = await publish();
    return result;
  }

  function handleTrendSelect(trend) {
    generate(trend.title);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div className="font-medium">Create market with AI</div>
      </div>

      {state === 'idle' && (
        <>
          <PromptInput onSubmit={generate} disabled={false} />
          <TrendsSection onSelectTrend={handleTrendSelect} disabled={false} />
        </>
      )}

      {drafting && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="animate-pulse">Drafting market…</span>
          </div>
          <div className="space-y-2 animate-pulse">
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
          </div>
          <Button size="sm" variant="ghost" onClick={cancel}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      )}

      {previewing && draft && (
        <DraftPreview
          draft={draft}
          onChange={edit}
          onPublish={handlePublish}
          onDiscard={discard}
          error={error}
        />
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <div className="text-sm text-red-600">{error}</div>
          <Button size="sm" variant="secondary" onClick={discard}>Reset</Button>
        </div>
      )}
    </Card>
  );
}
