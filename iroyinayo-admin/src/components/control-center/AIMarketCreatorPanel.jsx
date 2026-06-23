'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function AIMarketCreatorPanel() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div className="font-medium">Create market with AI</div>
      </div>
      <p className="text-sm text-muted-foreground">
        Coming soon. Spec 2 will enable AI-assisted market drafting from text prompts or RSS trends.
      </p>
      <Button size="sm" className="mt-3" disabled>Draft with AI</Button>
    </Card>
  );
}
