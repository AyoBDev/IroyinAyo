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
  if (value === 0) return <span className="text-[13px] text-muted-foreground">no change</span>;
  const isPositive = value > 0;
  return (
    <span className={`text-[13px] font-medium ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
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
      <div className="text-[#EF4444] text-[14px]">Error: {error}</div>
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
    <div className="max-w-[1400px]">
      <h1 className="text-[22px] font-bold mb-8" style={{ fontFamily: 'Satoshi, sans-serif' }}>Dashboard</h1>

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
        <Card className="mb-8 border-[#F59E0B]/30 bg-[#F59E0B]/5">
          <CardContent className="py-5 px-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[14px] font-semibold">Pending Rewards</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {rewardBudget.pendingCount} pending &middot; Weekly cap: ₦10,000
                </p>
              </div>
              <span className="text-[22px] font-bold" style={{ fontFamily: 'Satoshi, sans-serif' }}>₦{rewardBudget.pendingValue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[16px] font-semibold">Daily Engagement</CardTitle>
            <p className="text-[13px] text-muted-foreground">Predictions and unique users over 14 days</p>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2940" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#7B8BA3' }} tickLine={false} axisLine={{ stroke: '#1E2940' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#7B8BA3' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#141B2D', border: '1px solid #1E2940', borderRadius: '8px', fontSize: '13px' }}
                    labelStyle={{ color: '#F0F4F8', fontWeight: 600, marginBottom: '4px' }}
                    itemStyle={{ color: '#7B8BA3' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }} />
                  <Area type="monotone" dataKey="predictions" name="Predictions" stroke="#A78BFA" fill="rgba(167, 139, 250, 0.15)" strokeWidth={2} />
                  <Area type="monotone" dataKey="users" name="Unique Users" stroke="#10B981" fill="rgba(16, 185, 129, 0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-[14px] py-16 text-center">No activity data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[16px] font-semibold">Daily Signups</CardTitle>
            <p className="text-[13px] text-muted-foreground">New user registrations over 14 days</p>
          </CardHeader>
          <CardContent>
            {signupData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={signupData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2940" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#7B8BA3' }} tickLine={false} axisLine={{ stroke: '#1E2940' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#7B8BA3' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#141B2D', border: '1px solid #1E2940', borderRadius: '8px', fontSize: '13px' }}
                    labelStyle={{ color: '#F0F4F8', fontWeight: 600, marginBottom: '4px' }}
                    itemStyle={{ color: '#7B8BA3' }}
                  />
                  <Bar dataKey="signups" name="New Users" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-[14px] py-16 text-center">No signup data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sponsored Market Performance */}
      {kpis?.sponsored?.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-[16px] font-semibold">Sponsored Market Performance</CardTitle>
            <p className="text-[13px] text-muted-foreground">Engagement metrics for branded markets</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Market</TableHead>
                  <TableHead className="text-[13px]">Sponsor</TableHead>
                  <TableHead className="text-[13px] text-right">Predictions</TableHead>
                  <TableHead className="text-[13px] text-right">Unique Users</TableHead>
                  <TableHead className="text-[13px] text-right">Points Volume</TableHead>
                  <TableHead className="text-[13px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.sponsored.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-medium text-[14px] max-w-[220px] truncate">
                      {market.title}
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {market.sponsor_name || '—'}
                      {market.is_featured && <Badge className="ml-2 bg-[#6366F1] text-[11px]">Featured</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-[14px] font-semibold tabular-nums">{market.total_predictions}</TableCell>
                    <TableCell className="text-right text-[14px] font-semibold tabular-nums">{market.unique_predictors}</TableCell>
                    <TableCell className="text-right text-[14px] font-semibold tabular-nums">{market.points_volume.toLocaleString()}</TableCell>
                    <TableCell>
                      {market.status === 'resolved' ? (
                        <Badge className="bg-[#A78BFA] text-[11px]">Resolved</Badge>
                      ) : (
                        <Badge className="bg-[#10B981] text-[11px]">Open</Badge>
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
          <CardTitle className="text-[16px] font-semibold">Weekly Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-[14px]">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Rank</TableHead>
                  <TableHead className="text-[13px]">Name</TableHead>
                  <TableHead className="text-[13px] text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-[14px] font-medium">
                      {i < 3 ? (
                        <span className={i === 0 ? 'text-[#F59E0B]' : i === 1 ? 'text-[#7B8BA3]' : 'text-[#A78BFA]'}>
                          #{i + 1}
                        </span>
                      ) : (
                        `#${i + 1}`
                      )}
                    </TableCell>
                    <TableCell className="text-[14px] font-medium">{entry.name}</TableCell>
                    <TableCell className="text-right text-[14px] font-semibold tabular-nums">
                      {Number(entry.total_points).toLocaleString()}
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
