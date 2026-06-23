'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

const TILES = [
  { label: 'Markets', href: '/markets' },
  { label: 'Students', href: '/students' },
  { label: 'Quizzes', href: '/quizzes' },
  { label: 'Schedules', href: '/schedules' },
  { label: 'Ambassadors', href: '/ambassadors' },
  { label: 'Content', href: '/content' },
  { label: 'Rewards', href: '/rewards' },
];

export function ManageStrip() {
  return (
    <section className="px-4 py-6 border-t border-border">
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">{t.label}</Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
