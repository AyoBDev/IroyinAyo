'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserPlus, UserMinus, Search } from 'lucide-react';

export default function AmbassadorsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showPromote, setShowPromote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const result = await api.get('/ambassador-admin/performance');
      setData(result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDemote(studentId) {
    if (!confirm('Remove ambassador status?')) return;
    try {
      await api.post(`/ambassador-admin/${studentId}/demote`);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const students = await api.get(`/students?limit=20&search=${encodeURIComponent(searchQuery)}`);
      setSearchResults((students.students || students).filter(s => !s.is_ambassador));
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handlePromote(studentId) {
    try {
      await api.post(`/ambassador-admin/${studentId}/promote`);
      setShowPromote(false);
      setSearchQuery('');
      setSearchResults([]);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ambassador Dashboard</h1>
        <Button onClick={() => setShowPromote(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Ambassador
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Ambassadors" value={data.summary.total_ambassadors} />
            <StatCard label="Active This Week" value={data.summary.active_this_week} />
            <StatCard label="Referrals This Week" value={data.summary.total_referrals_this_week} />
            <StatCard label="Markets This Week" value={data.summary.total_markets_this_week} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance (This Week)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.ambassadors.length === 0 ? (
                <p className="text-muted-foreground text-sm">No ambassadors yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.ambassadors.map((amb) => (
                    <div key={amb.id} className="border rounded-lg p-4 bg-card flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{amb.name}</span>
                          {amb.is_active_this_week ? (
                            <Badge className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Referrals: {amb.weekly_referrals} this week / {amb.total_referrals} total</span>
                          <span>Markets: {amb.weekly_markets_created} this week / {amb.markets_created} total</span>
                          <span>Points: {amb.points_balance}</span>
                        </div>
                        {!amb.is_active_this_week && (
                          <p className="text-xs text-orange-600 mt-1">
                            Needs 5+ referrals or 2+ markets this week to qualify for payment
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleDemote(amb.id)} title="Remove ambassador">
                        <UserMinus className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showPromote} onOpenChange={setShowPromote}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Promote Student to Ambassador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-auto">
                {searchResults.map((student) => (
                  <div key={student.id} className="flex justify-between items-center p-2 border rounded text-sm">
                    <div>
                      <span className="font-medium">{student.name}</span>
                      <span className="text-muted-foreground ml-2">{student.phone_number}</span>
                    </div>
                    <Button size="sm" onClick={() => handlePromote(student.id)}>
                      Promote
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromote(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
