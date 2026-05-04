'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus } from 'lucide-react';

export default function RewardsPage() {
  const [options, setOptions] = useState([]);
  const [pending, setPending] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', type: 'airtime', points_cost: '', value: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [opts, pend] = await Promise.all([
        api.get('/rewards/options'),
        api.get('/rewards/pending'),
      ]);
      setOptions(opts);
      setPending(pend);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/rewards/options', {
        ...form,
        points_cost: parseInt(form.points_cost, 10),
      });
      setShowCreate(false);
      setForm({ name: '', type: 'airtime', points_cost: '', value: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFulfill(id) {
    try {
      await api.post(`/rewards/${id}/fulfill`);
      setFulfillTarget(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const optionColumns = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('name')}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('type');
        return (
          <Badge
            className={
              type === 'airtime'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }
          >
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'points_cost',
      header: ({ column }) => (
        <SortableHeader column={column}>Cost</SortableHeader>
      ),
      cell: ({ row }) => <span>{row.getValue('points_cost')} pts</span>,
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue('value')}</span>
      ),
    },
  ];

  const pendingColumns = [
    {
      accessorKey: 'student_name',
      header: 'Student',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="font-medium">{r.student_name || r.student_id}</span>
        );
      },
    },
    {
      accessorKey: 'reward_name',
      header: 'Reward',
      cell: ({ row }) => {
        const r = row.original;
        return <span>{r.reward_name || r.reward_option_id}</span>;
      },
    },
    {
      accessorKey: 'phone_number',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue('phone_number') || '\u2014'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Date</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.getValue('created_at')).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0" />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFulfillTarget(r)}>
                Fulfill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Rewards</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Reward Option
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Reward Options ({options.length})
          </h2>
          <DataTable
            columns={optionColumns}
            data={options}
            searchKey="name"
            searchPlaceholder="Search rewards..."
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">
            Pending Redemptions ({pending.length})
          </h2>
          <DataTable
            columns={pendingColumns}
            data={pending}
            searchKey="student_name"
            searchPlaceholder="Search redemptions..."
          />
        </div>
      </div>

      {/* Create Reward Option Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Reward Option</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="MTN 500MB Data"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="airtime">Airtime</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Points Cost</label>
              <Input
                type="number"
                value={form.points_cost}
                onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
                required
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Value</label>
              <Input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
                placeholder="N200 airtime"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fulfill Confirmation Dialog */}
      <Dialog open={!!fulfillTarget} onOpenChange={(open) => !open && setFulfillTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fulfill Redemption</DialogTitle>
            <DialogDescription>
              Fulfill {fulfillTarget?.reward_name || fulfillTarget?.reward_option_id} for{' '}
              {fulfillTarget?.student_name || fulfillTarget?.student_id}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFulfillTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => fulfillTarget && handleFulfill(fulfillTarget.id)}
            >
              Fulfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
