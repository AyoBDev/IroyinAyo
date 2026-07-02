'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Users, TrendingUp, DollarSign, Activity } from 'lucide-react';

export default function CirclesPage() {
  const [overview, setOverview] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [abandoned, setAbandoned] = useState([]);
  const [topCircles, setTopCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [overviewData, disputesData, abandonedData, topData] = await Promise.all([
        api.get('/admin/circles/overview'),
        api.get('/admin/circles/disputes'),
        api.get('/admin/circles/abandoned'),
        api.get('/admin/circles/top-active?limit=20'),
      ]);
      setOverview(overviewData);
      setDisputes(disputesData);
      setAbandoned(abandonedData);
      setTopCircles(topData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyResolveCommand(poolId) {
    const cmd = `curl -X POST "https://api.iroyinmarket.com/api/admin/circles/resolve/${poolId}" -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"winner_outcome":"OUTCOME"}'`;
    navigator.clipboard.writeText(cmd);
    alert('Resolve command copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading circles data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Circles</h1>
        <p className="text-muted-foreground mt-1">Friend-group prediction pools</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Circles (7d)</p>
              <p className="text-2xl font-bold mt-1">{overview?.circles7d || 0}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active this week</p>
              <p className="text-2xl font-bold mt-1">{overview?.activeCirclesWeek || 0}</p>
            </div>
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Volume (7d)</p>
              <p className="text-2xl font-bold mt-1">{(overview?.volume7d || 0).toLocaleString()} pts</p>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Disputes needing you</p>
              <p className="text-2xl font-bold mt-1">{overview?.disputesCount || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Alerts */}
      {(overview?.disputesCount > 0 || overview?.abandonedCount > 0) && (
        <div className="space-y-2">
          {overview.disputesCount > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100">
                  You have {overview.disputesCount} dispute{overview.disputesCount !== 1 ? 's' : ''} to resolve.
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">Review them in the Disputes section below.</p>
              </div>
            </div>
          )}

          {overview.abandonedCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                  {overview.abandonedCount} pool{overview.abandonedCount !== 1 ? 's are' : ' is'} approaching auto-refund (&gt;4 days closed).
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Nudge creators via WhatsApp before the 7-day auto-refund triggers.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disputes to Arbitrate */}
      {disputes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Disputes to Arbitrate</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Circle</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pool</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Creator</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Dispute Reason</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Raised</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute) => (
                    <tr key={dispute.pool_id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 text-sm">{dispute.circle_name}</td>
                      <td className="p-3 text-sm font-medium">{dispute.title}</td>
                      <td className="p-3 text-sm">{dispute.creator_name}</td>
                      <td className="p-3 text-sm max-w-xs truncate">{dispute.dispute_reason || '—'}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {dispute.raised_at ? new Date(dispute.raised_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyResolveCommand(dispute.pool_id)}
                        >
                          Copy resolve command
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Abandoned Pool Candidates */}
      {abandoned.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Abandoned Pool Candidates</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Circle</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pool</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Creator</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Closed</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Days Idle</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Predictions</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pot</th>
                  </tr>
                </thead>
                <tbody>
                  {abandoned.map((pool) => (
                    <tr key={pool.pool_id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 text-sm">{pool.circle_name}</td>
                      <td className="p-3 text-sm font-medium">{pool.title}</td>
                      <td className="p-3 text-sm">{pool.creator_name}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {pool.closed_at ? new Date(pool.closed_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3 text-sm">
                        <Badge variant={pool.days_since_closed >= 6 ? 'destructive' : 'secondary'}>
                          {pool.days_since_closed}d
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">{pool.predictions_count}</td>
                      <td className="p-3 text-sm">{(pool.predictions_count * 50).toLocaleString()} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Top Active Circles This Week */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Top Active Circles This Week</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Circle</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Members</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pools</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Volume</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Predictor</th>
                </tr>
              </thead>
              <tbody>
                {topCircles.map((circle, idx) => (
                  <tr key={circle.circle_id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3 text-sm font-medium">
                      {idx < 3 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold mr-2">
                          {idx + 1}
                        </span>
                      )}
                      {circle.name}
                    </td>
                    <td className="p-3 text-sm">{circle.member_count}</td>
                    <td className="p-3 text-sm">{circle.pools_7d}</td>
                    <td className="p-3 text-sm font-semibold">{circle.volume_7d.toLocaleString()} pts</td>
                    <td className="p-3 text-sm text-muted-foreground">{circle.top_predictor_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
