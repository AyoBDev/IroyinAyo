'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');

  const [rewardBudget, setRewardBudget] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [analytics, leaders] = await Promise.all([
          api.get('/admin/analytics'),
          api.get('/gamification/leaderboard?period=weekly'),
        ]);
        setStats(analytics);
        setLeaderboard(leaders);
      } catch (err) {
        setError(err.message);
      }
      try {
        const pending = await api.get('/rewards/pending');
        const totalPendingValue = pending.reduce((sum, r) => sum + (parseInt(r.reward_value, 10) || 0), 0);
        setRewardBudget({ pendingCount: pending.length, pendingValue: totalPendingValue });
      } catch {}
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="text-destructive">Error: {error}</div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Students" value={stats?.total_students} />
        <StatCard label="Active Today" value={stats?.active_today} />
        <StatCard label="Points Issued" value={stats?.total_points_issued} />
        <StatCard label="Total Redemptions" value={stats?.total_redemptions} />
        <StatCard label="Pending Redemptions" value={stats?.pending_redemptions} />
        <StatCard label="Open Markets" value={stats?.open_markets} />
      </div>

      {rewardBudget && rewardBudget.pendingCount > 0 && (
        <Card className="mb-8 border-orange-200 bg-orange-50/50">
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Pending Rewards</p>
                <p className="text-xs text-muted-foreground">
                  {rewardBudget.pendingCount} pending &middot; Weekly cap: ₦10,000
                </p>
              </div>
              <span className="text-lg font-bold">₦{rewardBudget.pendingValue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(entry.total_points)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
