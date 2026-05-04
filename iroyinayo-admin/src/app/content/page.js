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
import { MoreHorizontal, Sparkles, Plus } from 'lucide-react';

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];

export default function ContentPage() {
  const [items, setItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genCategory, setGenCategory] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', body: '', is_broadcast: false, categories: [], is_approved: true,
  });

  useEffect(() => { loadContent(); }, []);

  async function loadContent() {
    try {
      const data = await api.get('/content?limit=1000');
      setItems(data.content);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/content', form);
      setShowCreate(false);
      setForm({ title: '', body: '', is_broadcast: false, categories: [], is_approved: true });
      loadContent();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApprove(id) {
    try {
      await api.post(`/content/${id}/approve`);
      loadContent();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePublish(id) {
    try {
      await api.post(`/content/${id}/publish`);
      loadContent();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const body = genCategory ? { category: genCategory } : {};
      await api.post('/content/generate', body);
      setGenCategory('');
      loadContent();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function toggleCategory(cat) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  const columns = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <SortableHeader column={column}>Title</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('title')}</span>
      ),
    },
    {
      accessorKey: 'categories',
      header: 'Categories',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1 flex-wrap">
            {item.categories?.map((c) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))}
            {item.source === 'ai' && (
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">AI</Badge>
            )}
            {item.is_broadcast && (
              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">broadcast</Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'is_published',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        if (item.is_published) {
          return <Badge className="bg-green-600 hover:bg-green-700">Published</Badge>;
        }
        if (item.is_approved) {
          return <Badge className="bg-blue-600 hover:bg-blue-700">Approved</Badge>;
        }
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Created</SortableHeader>
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
        const item = row.original;
        const hasActions = !item.is_approved || (item.is_approved && !item.is_published);
        if (!hasActions) return null;
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
              {!item.is_approved && (
                <DropdownMenuItem onClick={() => handleApprove(item.id)}>
                  Approve
                </DropdownMenuItem>
              )}
              {item.is_approved && !item.is_published && (
                <DropdownMenuItem onClick={() => handlePublish(item.id)}>
                  Publish
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
        <h1 className="text-2xl font-bold">Content ({items.length})</h1>
        <div className="flex gap-2 items-center">
          <Select value={genCategory} onValueChange={setGenCategory}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {generating ? 'Generating...' : 'AI Generate'}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Content
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        searchKey="title"
        searchPlaceholder="Search content..."
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Content</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Body</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={form.categories.includes(cat) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="broadcast"
                checked={form.is_broadcast}
                onChange={(e) => setForm({ ...form, is_broadcast: e.target.checked })}
              />
              <label htmlFor="broadcast" className="text-sm">
                Broadcast to all students
              </label>
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
    </div>
  );
}
