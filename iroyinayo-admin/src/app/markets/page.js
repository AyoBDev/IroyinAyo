'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

const CATEGORIES = [
  'campus_news', 'sports', 'entertainment', 'academic', 'tech',
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(null);
  const [sponsorAmount, setSponsorAmount] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    question: '', description: '', category: 'campus_news',
    closes_at: '', created_by_type: 'admin', sponsor_bonus: 0,
  });

  useEffect(() => { loadMarkets(); }, []);

  async function loadMarkets() {
    try {
      const data = await api.get('/markets/all?limit=1000');
      setMarkets(data.markets);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/markets', form);
      setShowCreate(false);
      setForm({ question: '', description: '', category: 'campus_news', closes_at: '', created_by_type: 'admin', sponsor_bonus: 0 });
      loadMarkets();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApprove(id) {
    try {
      await api.post(`/markets/${id}/approve`);
      loadMarkets();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResolve(id, outcome) {
    try {
      await api.post(`/markets/${id}/resolve`, { outcome });
      setResolveModal(null);
      loadMarkets();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSponsor(id) {
    try {
      const amount = parseInt(sponsorAmount, 10);
      if (!amount || amount <= 0) return;
      await api.post(`/markets/${id}/sponsor`, { amount });
      setSponsorModal(null);
      setSponsorAmount('');
      loadMarkets();
    } catch (err) {
      setError(err.message);
    }
  }

  function statusBadge(market) {
    if (market.status === 'resolved') {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Resolved ({market.outcome})</Badge>;
    }
    if (!market.is_approved) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
    }
    if (new Date(market.closes_at) <= new Date()) {
      return <Badge variant="destructive">Closed</Badge>;
    }
    return <Badge className="bg-green-600 hover:bg-green-700">Open</Badge>;
  }

  const columns = [
    {
      accessorKey: 'question',
      header: ({ column }) => (
        <SortableHeader column={column}>Question</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium max-w-xs truncate block">
          {row.getValue('question')}
        </span>
      ),
    },
    {
      id: 'odds',
      header: 'Yes% / No%',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span className="text-xs">
            <span className="text-green-600">{(m.yes_price * 100).toFixed(0)}%</span>
            {' / '}
            <span className="text-red-600">{(m.no_price * 100).toFixed(0)}%</span>
          </span>
        );
      },
    },
    {
      id: 'pool',
      header: 'Pool',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span className="text-xs text-muted-foreground">
            {m.yes_pool + m.no_pool} pts
            {m.sponsor_bonus > 0 && (
              <span className="text-yellow-600 ml-1">(+{m.sponsor_bonus} bonus)</span>
            )}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => statusBadge(row.original),
    },
    {
      accessorKey: 'closes_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Closes</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {new Date(row.getValue('closes_at')).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const m = row.original;
        const hasApprove = !m.is_approved;
        const hasResolve = m.status === 'open' && m.is_approved;
        const hasSponsor = m.status === 'open' && m.is_approved;
        if (!hasApprove && !hasResolve && !hasSponsor) return null;
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
              {hasApprove && (
                <DropdownMenuItem onClick={() => handleApprove(m.id)}>
                  Approve
                </DropdownMenuItem>
              )}
              {hasResolve && (
                <DropdownMenuItem onClick={() => setResolveModal(m)}>
                  Resolve
                </DropdownMenuItem>
              )}
              {hasSponsor && (
                <DropdownMenuItem onClick={() => setSponsorModal(m)}>
                  Sponsor
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Markets ({markets.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Market
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={markets}
        searchKey="question"
        searchPlaceholder="Search markets..."
      />

      {/* Create Market Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Market</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Question</label>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
                placeholder="Will ASUU call off the strike before June?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Closes At</label>
              <Input
                type="datetime-local"
                value={form.closes_at}
                onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sponsor Bonus</label>
              <Input
                type="number"
                value={form.sponsor_bonus}
                onChange={(e) => setForm({ ...form, sponsor_bonus: parseInt(e.target.value, 10) || 0 })}
                min={0}
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

      {/* Resolve Market Dialog */}
      <Dialog open={!!resolveModal} onOpenChange={(open) => !open && setResolveModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolve Market</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{resolveModal?.question}</p>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleResolve(resolveModal.id, 'yes')}
            >
              YES
            </Button>
            <Button
              className="flex-1"
              variant="destructive"
              onClick={() => handleResolve(resolveModal.id, 'no')}
            >
              NO
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModal(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sponsor Market Dialog */}
      <Dialog open={!!sponsorModal} onOpenChange={(open) => { if (!open) { setSponsorModal(null); setSponsorAmount(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sponsor Market</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{sponsorModal?.question}</p>
          <div>
            <label className="block text-sm font-medium mb-1">Bonus Amount</label>
            <Input
              type="number"
              value={sponsorAmount}
              onChange={(e) => setSponsorAmount(e.target.value)}
              placeholder="Bonus points"
              min={1}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSponsorModal(null); setSponsorAmount(''); }}>
              Cancel
            </Button>
            <Button onClick={() => handleSponsor(sponsorModal.id)}>
              Add Sponsor Bonus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
