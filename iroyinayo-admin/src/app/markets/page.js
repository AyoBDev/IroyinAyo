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
import { Trophy, Plus, X } from 'lucide-react';

export default function MarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [resolveModal, setResolveModal] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newOutcomes, setNewOutcomes] = useState(['', '']);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => { loadMarkets(); }, []);

  async function loadMarkets() {
    try {
      const data = await api.get('/multi-markets/admin/all');
      setMarkets(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const outcomes = newOutcomes.filter(o => o.trim());
    if (!newTitle.trim() || outcomes.length < 2) return;
    setCreating(true);
    try {
      await api.post('/multi-markets', {
        title: newTitle.trim(),
        outcomes,
        category: newCategory.trim() || undefined,
      });
      setShowCreate(false);
      setNewTitle('');
      setNewOutcomes(['', '']);
      setNewCategory('');
      loadMarkets();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleResolve(marketId, outcomeId) {
    setResolving(true);
    try {
      await api.post(`/multi-markets/${marketId}/resolve`, { outcomeId });
      setResolveModal(null);
      loadMarkets();
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Prediction Markets ({markets.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Market
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      <div className="space-y-4">
        {markets.map((market) => (
          <div key={market.id} className="border rounded-lg p-4 bg-card">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-sm">{market.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {market.outcomes?.length || 0} outcomes
                </span>
              </div>
              <div className="flex items-center gap-2">
                {market.status === 'resolved' ? (
                  <Badge className="bg-purple-600">Resolved</Badge>
                ) : (
                  <Badge className="bg-green-600">Open</Badge>
                )}
                {market.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => setResolveModal(market)}>
                    <Trophy className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                )}
              </div>
            </div>

            {market.status === 'resolved' && market.winning_outcome_id && (
              <div className="text-xs text-green-600 font-medium">
                Winner: {market.outcomes?.find(o => o.id === market.winning_outcome_id)?.label || 'Unknown'}
              </div>
            )}

            {market.outcomes && market.outcomes.length > 0 && market.status === 'open' && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {market.outcomes.slice(0, 8).map((o) => (
                  <div key={o.id} className="text-xs px-2 py-1 bg-muted rounded flex justify-between">
                    <span className="truncate">{o.label}</span>
                  </div>
                ))}
                {market.outcomes.length > 8 && (
                  <div className="text-xs px-2 py-1 text-muted-foreground">
                    +{market.outcomes.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Market Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Prediction Market</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Question</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="Who will win the Engineering vs Science match?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category (optional)</label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="sports, politics, entertainment..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Outcomes</label>
              <div className="space-y-2">
                {newOutcomes.map((outcome, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={outcome}
                      onChange={(e) => {
                        const updated = [...newOutcomes];
                        updated[i] = e.target.value;
                        setNewOutcomes(updated);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    {newOutcomes.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewOutcomes(newOutcomes.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewOutcomes([...newOutcomes, ''])}
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
              <Button type="submit" disabled={creating || !newTitle.trim() || newOutcomes.filter(o => o.trim()).length < 2}>
                {creating ? 'Creating...' : 'Create Market'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveModal} onOpenChange={(open) => !open && setResolveModal(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Resolve: {resolveModal?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Select the winning outcome. This will pay out all correct predictions.
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {resolveModal?.outcomes?.map((outcome) => (
              <Button
                key={outcome.id}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3"
                disabled={resolving}
                onClick={() => handleResolve(resolveModal.id, outcome.id)}
              >
                <Trophy className="h-4 w-4 mr-2 text-yellow-500 shrink-0" />
                <span className="truncate">{outcome.label}</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModal(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
