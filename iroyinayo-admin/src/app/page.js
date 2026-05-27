'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function TrendIndicator({ value, suffix = '' }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">no change</span>;
  const isPositive = value > 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      {isPositive ? '+' : ''}{value}{suffix} vs last week
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');
  const [rewardBudget, setRewardBudget] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [analytics, leaders, dashKpis] = await Promise.all([
          api.get('/admin/analytics'),
          api.get('/gamification/leaderboard?period=weekly'),
          api.get('/admin/dashboard-kpis'),
        ]);
        setStats(analytics);
        setLeaderboard(leaders);
        setKpis(dashKpis);
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

  const chartData = kpis?.charts?.daily_activity?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
    predictions: parseInt(d.predictions || 0, 10),
    users: parseInt(d.unique_users || 0, 10),
    volume: parseInt(d.volume || 0, 10),
  })) || [];

  const signupData = kpis?.charts?.daily_signups?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
    signups: parseInt(d.signups || 0, 10),
  })) || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Core Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={kpis?.overview?.total_users ?? stats?.total_students} />
        <StatCard
          label="Weekly Active Users"
          value={kpis?.overview?.weekly_active_users}
          sub={kpis && <TrendIndicator value={kpis.overview.wau_change} />}
        />
        <StatCard
          label="Weekly Predictions"
          value={kpis?.overview?.weekly_predictions}
          sub={kpis && <TrendIndicator value={kpis.overview.predictions_change} />}
        />
        <StatCard
          label="Retention Rate"
          value={kpis?.overview?.retention_rate != null ? `${kpis.overview.retention_rate}%` : null}
          sub="users returning week over week"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="New Signups (7d)" value={kpis?.overview?.weekly_signups} />
        <StatCard label="Points Volume (7d)" value={kpis?.overview?.weekly_points_volume?.toLocaleString()} />
        <StatCard label="Avg Predictions / Market" value={kpis?.overview?.avg_predictions_per_market} />
        <StatCard label="Open Markets" value={kpis?.overview?.open_markets ?? stats?.open_markets} />
      </div>

      {rewardBudget && rewardBudget.pendingCount > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50/50">
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Engagement (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="predictions" name="Predictions" stroke="#8b5cf6" fill="#8b5cf680" />
                  <Area type="monotone" dataKey="users" name="Unique Users" stroke="#10b981" fill="#10b98180" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">No activity data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Signups (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {signupData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={signupData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="signups" name="New Users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">No signup data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sponsored Market Performance */}
      {kpis?.sponsored?.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sponsored Market Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Sponsor</TableHead>
                  <TableHead className="text-right">Predictions</TableHead>
                  <TableHead className="text-right">Unique Users</TableHead>
                  <TableHead className="text-right">Points Volume</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.sponsored.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {market.title}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{market.sponsor_name || '—'}</span>
                      {market.is_featured && <Badge className="ml-2 bg-blue-600 text-[10px]">Featured</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{market.total_predictions}</TableCell>
                    <TableCell className="text-right font-medium">{market.unique_predictors}</TableCell>
                    <TableCell className="text-right font-medium">{market.points_volume.toLocaleString()}</TableCell>
                    <TableCell>
                      {market.status === 'resolved' ? (
                        <Badge className="bg-purple-600">Resolved</Badge>
                      ) : (
                        <Badge className="bg-green-600">Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Weekly Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Weekly Leaderboard</CardTitle>
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
