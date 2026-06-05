'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, TrendingUp, BarChart3, Clock } from 'lucide-react';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function MarketAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const analytics = await api.get(`/multi-markets/admin/${params.id}/analytics`);
        setData(analytics);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading analytics...</div>;
  }

  if (error) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/markets')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm">{error}</div>
      </div>
    );
  }

  const { market, summary, outcomes, recent_positions } = data;

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push('/markets')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Markets
      </Button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold">{market.title}</h1>
          {market.status === 'resolved' ? (
            <Badge className="bg-purple-600">Resolved</Badge>
          ) : (
            <Badge className="bg-green-600">Open</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {market.category && <span>Category: {market.category}</span>}
          <span>Liquidity b={market.liquidity_b}</span>
          <span>Created {timeAgo(market.created_at)}</span>
          {market.closes_at && <span>Closes {new Date(market.closes_at).toLocaleString()}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card size="sm">
          <CardContent className="pt-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Volume</span>
            </div>
            <p className="text-xl font-bold">{summary.total_volume} pts</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Traders</span>
            </div>
            <p className="text-xl font-bold">{summary.unique_traders}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Positions</span>
            </div>
            <p className="text-xl font-bold">{summary.total_positions}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Avg Size</span>
            </div>
            <p className="text-xl font-bold">{summary.avg_position_size} pts</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout summary for resolved markets */}
      {market.status === 'resolved' && (
        <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-purple-300">
            Total payouts: {summary.total_payout} pts
            {market.winning_outcome_id && (
              <span className="ml-3 text-purple-400">
                Winner: {outcomes.find(o => o.id === market.winning_outcome_id)?.label}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Outcome Breakdown */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Outcome Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {outcomes.map((o) => {
              const volumePercent = summary.total_volume > 0
                ? Math.round((o.volume / summary.total_volume) * 100)
                : 0;
              const isWinner = market.winning_outcome_id === o.id;
              return (
                <div key={o.id} className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{o.label}</span>
                      {isWinner && <Badge className="bg-green-600 text-[10px] px-1.5 py-0">Winner</Badge>}
                    </div>
                    <span className="text-sm font-bold">{Math.round(o.price * 100)}%</span>
                  </div>
                  <div className="h-6 bg-muted rounded-md overflow-hidden relative">
                    <div
                      className={`h-full rounded-md ${isWinner ? 'bg-green-600/40' : 'bg-primary/20'}`}
                      style={{ width: `${volumePercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                      <span>{o.volume} pts ({volumePercent}%)</span>
                      <span className="text-muted-foreground">{o.traders} traders, {o.positions} positions</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent_positions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No predictions yet (excluding house account)</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3">User</th>
                    <th className="text-left py-2 pr-3">Outcome</th>
                    <th className="text-right py-2 pr-3">Amount</th>
                    <th className="text-right py-2 pr-3">Shares</th>
                    <th className="text-right py-2 pr-3">Entry</th>
                    {market.status === 'resolved' && <th className="text-right py-2 pr-3">Payout</th>}
                    <th className="text-right py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_positions.map((p, i) => (
                    <tr key={i} className="border-b border-muted/50">
                      <td className="py-2 pr-3 font-medium">{p.student_name}</td>
                      <td className="py-2 pr-3">{p.outcome_label}</td>
                      <td className="py-2 pr-3 text-right">{p.amount} pts</td>
                      <td className="py-2 pr-3 text-right">{Number(p.shares).toFixed(1)}</td>
                      <td className="py-2 pr-3 text-right">
                        {p.entry_price ? `${Math.round(p.entry_price * 100)}%` : '-'}
                      </td>
                      {market.status === 'resolved' && (
                        <td className={`py-2 pr-3 text-right font-medium ${p.payout > 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {p.payout > 0 ? `+${p.payout}` : '0'}
                        </td>
                      )}
                      <td className="py-2 text-right text-muted-foreground">{timeAgo(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
