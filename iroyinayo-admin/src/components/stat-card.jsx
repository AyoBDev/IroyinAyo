import { Card, CardContent } from '@/components/ui/card';

export function StatCard({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[28px] font-bold mt-2 tracking-tight" style={{ fontFamily: 'Satoshi, sans-serif' }}>{value ?? '—'}</p>
        {sub && <p className="text-[13px] text-muted-foreground mt-2">{sub}</p>}
      </CardContent>
    </Card>
  );
}
