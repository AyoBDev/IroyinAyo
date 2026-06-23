'use client';
import { useEffect } from 'react';
import { HealthStrip } from '@/components/control-center/HealthStrip';
import { TodaysWorkZone } from '@/components/control-center/TodaysWorkZone';
import { WeeklyQueueZone } from '@/components/control-center/WeeklyQueueZone';
import { ManageStrip } from '@/components/control-center/ManageStrip';
import { cc } from '@/lib/api';
import { track } from '@/lib/telemetry';

export default function ControlCenterPage() {
  useEffect(() => {
    cc.getSummary().then((s) => {
      track('cc_load', {
        panels_with_items: {
          resolve: s.marketsToResolve,
          pending_markets: s.pendingUserMarkets,
          content: s.pendingContent,
          redemptions: s.pendingRedemptions,
          alerts: s.simulationAlerts,
          reports: s.marketReports,
          bans: s.recentBansCount,
          weekly_winner: s.weeklyWinnerUnpaid ? 1 : 0,
        },
      });
    }).catch(() => track('cc_load', { panels_with_items: null }));
  }, []);

  return (
    <main className="min-h-screen">
      <HealthStrip />
      <TodaysWorkZone />
      <WeeklyQueueZone />
      <ManageStrip />
    </main>
  );
}
