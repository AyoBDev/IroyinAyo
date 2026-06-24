'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cc } from '@/lib/api';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export function TrendsSection({ onSelectTrend, disabled }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await cc.getAIMarketTrends();
      setTrends(result.trends || []);
      setFetchedAt(result.fetchedAt);
    } catch (err) {
      setError(err.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && trends.length === 0 && !loading) {
      await refresh();
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1 text-sm font-medium"
          onClick={handleToggle}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Trending now
        </button>
        {open && (
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {error && <div className="text-xs text-red-600">{error}</div>}
          {loading && trends.length === 0 && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && trends.length === 0 && !error && (
            <div className="text-xs text-muted-foreground">No trending suggestions right now.</div>
          )}
          {trends.map((t, idx) => (
            <Card key={`${t.url}-${idx}`} className="p-2">
              <div className="text-sm">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.source} · {t.category}</div>
              <Button size="sm" variant="secondary" className="mt-2" disabled={disabled} onClick={() => onSelectTrend(t)}>
                Use this
              </Button>
            </Card>
          ))}
          {fetchedAt && <div className="text-xs text-muted-foreground">Last refreshed: {new Date(fetchedAt).toLocaleTimeString()}</div>}
        </div>
      )}
    </div>
  );
}
