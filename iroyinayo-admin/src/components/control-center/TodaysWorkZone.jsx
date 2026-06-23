'use client';
import { ResolveMarketsPanel } from './ResolveMarketsPanel';
import { PendingUserMarketsPanel } from './PendingUserMarketsPanel';
import { PendingContentPanel } from './PendingContentPanel';
import { PendingRedemptionsPanel } from './PendingRedemptionsPanel';
import { Card } from '@/components/ui/card';

export function TodaysWorkZone() {
  return (
    <section className="px-4 py-6">
      <h2 className="text-2xl font-serif font-semibold mb-4">Today&apos;s work</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResolveMarketsPanel />
        <PendingUserMarketsPanel />
        <PendingContentPanel />
        <PendingRedemptionsPanel />
        {['Create market with AI'].map((label) => (
          <Card key={label} className="p-4">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground mt-2">(loading…)</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
