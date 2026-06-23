'use client';
import { SimulationAlertsPanel } from './SimulationAlertsPanel';
import { MarketReportsPanel } from './MarketReportsPanel';
import { BanQueuePanel } from './BanQueuePanel';
import { WeeklyWinnerPanel } from './WeeklyWinnerPanel';

export function WeeklyQueueZone() {
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-2xl font-serif font-semibold mb-4">Weekly queue</h2>
      <div className="space-y-3">
        <SimulationAlertsPanel />
        <MarketReportsPanel />
        <BanQueuePanel />
        <WeeklyWinnerPanel />
      </div>
    </section>
  );
}
