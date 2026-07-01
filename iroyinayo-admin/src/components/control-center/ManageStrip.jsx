'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cc } from '@/lib/api';
import { usePolling } from './usePolling';

const TILES = [
  { label: 'Markets', href: '/markets', countKey: 'markets' },
  { label: 'Students', href: '/students', countKey: 'students' },
  { label: 'Circles', href: '/circles', countKey: 'circles' },
  { label: 'Quizzes', href: '/quizzes', countKey: 'quizzes' },
  { label: 'Schedules', href: '/schedules', countKey: 'schedules' },
  { label: 'Ambassadors', href: '/ambassadors', countKey: 'ambassadors' },
  { label: 'Content', href: '/content', countKey: 'content' },
];

export function ManageStrip() {
  const { data } = usePolling(cc.getSummary, 30000);
  const totals = data?.totalsManageStrip || {};
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
              {t.label} {typeof totals[t.countKey] === 'number' && (<span className="text-muted-foreground ml-1">({totals[t.countKey]})</span>)}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
