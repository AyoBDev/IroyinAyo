import { HealthStrip } from '@/components/control-center/HealthStrip';
import { TodaysWorkZone } from '@/components/control-center/TodaysWorkZone';
import { WeeklyQueueZone } from '@/components/control-center/WeeklyQueueZone';
import { ManageStrip } from '@/components/control-center/ManageStrip';

export default function ControlCenterPage() {
  return (
    <main className="min-h-screen">
      <HealthStrip />
      <TodaysWorkZone />
      <WeeklyQueueZone />
      <ManageStrip />
    </main>
  );
}
