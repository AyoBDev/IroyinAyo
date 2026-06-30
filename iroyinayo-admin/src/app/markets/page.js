'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trophy, Plus, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CreateMarketDialog from '../../components/markets/CreateMarketDialog';

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState([]);
  const [resolveModal, setResolveModal] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [liquidityInfo, setLiquidityInfo] = useState(null);

  useEffect(() => {
    loadMarkets();
    api.get('/multi-markets/admin/liquidity-info').then(setLiquidityInfo).catch(() => {});
  }, []);

  async function loadMarkets() {
    try {
      const data = await api.get('/multi-markets/admin/all');
      setMarkets(data);
    } catch (err) {
      setError(err.message);
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
        <div>
          <h1 className="text-2xl font-bold">Prediction Markets ({markets.length})</h1>
          {liquidityInfo && (
            <p className="text-xs text-muted-foreground mt-1">
              Auto liquidity: b={liquidityInfo.autoLiquidityB} ({liquidityInfo.activeUsers} active users this week)
            </p>
          )}
        </div>
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
                {market.is_sponsored && (
                  <Badge className="bg-yellow-600">Sponsored</Badge>
                )}
                {market.is_featured && (
                  <Badge className="bg-blue-600">Featured</Badge>
                )}
                {market.status === 'resolved' ? (
                  <Badge className="bg-purple-600">Resolved</Badge>
                ) : (
                  <Badge className="bg-green-600">Open</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => router.push(`/markets/${market.id}`)}>
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analytics
                </Button>
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

      <CreateMarketDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadMarkets}
      />

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
