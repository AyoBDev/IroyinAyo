'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Play, Pause, Trash2, Zap } from 'lucide-react';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: '',
    outcomes: ['', ''],
    cronExpression: '0 8 * * 1',
    category: '',
    liquidityB: '25',
  });

  useEffect(() => { loadSchedules(); }, []);

  async function loadSchedules() {
    try {
      const data = await api.get('/schedules');
      setSchedules(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const outcomes = form.outcomes.filter(o => o.trim());
    if (!form.title.trim() || outcomes.length < 2) return;
    setCreating(true);
    try {
      await api.post('/schedules', {
        title: form.title.trim(),
        outcomes,
        cronExpression: form.cronExpression.trim(),
        category: form.category.trim() || undefined,
        liquidityB: parseInt(form.liquidityB, 10) || 25,
      });
      setShowCreate(false);
      setForm({ title: '', outcomes: ['', ''], cronExpression: '0 8 * * 1', category: '', liquidityB: '25' });
      loadSchedules();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleTrigger(id) {
    try {
      await api.post(`/schedules/${id}/trigger`);
      loadSchedules();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(schedule) {
    try {
      await api.put(`/schedules/${schedule.id}`, { active: !schedule.active });
      loadSchedules();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this schedule?')) return;
    try {
      await api.delete(`/schedules/${id}`);
      loadSchedules();
    } catch (err) {
      setError(err.message);
    }
  }

  const CRON_PRESETS = [
    { label: 'Every Monday 8am', value: '0 8 * * 1' },
    { label: 'Every day 9am', value: '0 9 * * *' },
    { label: 'Every Friday 6pm', value: '0 18 * * 5' },
    { label: 'Every Saturday 10am', value: '0 10 * * 6' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Scheduled Markets ({schedules.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Schedule
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      <div className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-muted-foreground text-sm">No scheduled markets yet. Create one to auto-generate markets on a schedule.</p>
        )}
        {schedules.map((s) => (
          <div key={s.id} className="border rounded-lg p-4 bg-card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Cron: <code className="bg-muted px-1 rounded">{s.cron_expression}</code>
                  {s.category && <> &middot; {s.category}</>}
                  &middot; b={s.liquidity_b}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Outcomes: {(typeof s.outcomes === 'string' ? JSON.parse(s.outcomes) : s.outcomes).join(', ')}
                </p>
                {s.last_created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last run: {new Date(s.last_created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={s.active ? 'bg-green-600' : 'bg-gray-500'}>
                  {s.active ? 'Active' : 'Paused'}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => handleTrigger(s.id)} title="Run now">
                  <Zap className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggle(s)} title={s.active ? 'Pause' : 'Resume'}>
                  {s.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)} title="Delete">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Create Scheduled Market</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title template</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="BBNaija Week Prediction {date}"
              />
              <p className="text-xs text-muted-foreground mt-1">{'{date}'} is replaced with current date</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="entertainment, sports..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cron schedule</label>
              <Input
                value={form.cronExpression}
                onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                required
                placeholder="0 8 * * 1"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                    onClick={() => setForm({ ...form, cronExpression: p.value })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Liquidity (b parameter)</label>
              <Input
                type="number"
                value={form.liquidityB}
                onChange={(e) => setForm({ ...form, liquidityB: e.target.value })}
                min={5}
                max={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Outcomes</label>
              <div className="space-y-2">
                {form.outcomes.map((outcome, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={outcome}
                      onChange={(e) => {
                        const updated = [...form.outcomes];
                        updated[i] = e.target.value;
                        setForm({ ...form, outcomes: updated });
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    {form.outcomes.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ ...form, outcomes: form.outcomes.filter((_, j) => j !== i) })}
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, outcomes: [...form.outcomes, ''] })}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Option
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
