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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    question: '',
    options: ['', '', '', ''],
    correct_option: 0,
    category: 'academic',
    points_reward: 10,
  });

  useEffect(() => { loadQuizzes(); }, []);

  async function loadQuizzes() {
    try {
      const data = await api.get('/gamification/quizzes?limit=1000');
      setQuizzes(data.quizzes);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        correct_option: String.fromCharCode(65 + form.correct_option), // 0->A, 1->B, 2->C, 3->D
      };
      await api.post('/gamification/quizzes', payload);
      setShowCreate(false);
      setForm({ question: '', options: ['', '', '', ''], correct_option: 0, category: 'academic', points_reward: 10 });
      loadQuizzes();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateOption(index, value) {
    setForm((f) => {
      const options = [...f.options];
      options[index] = value;
      return { ...f, options };
    });
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
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.getValue('category')}</Badge>
      ),
    },
    {
      accessorKey: 'points_reward',
      header: ({ column }) => (
        <SortableHeader column={column}>Points</SortableHeader>
      ),
    },
    {
      id: 'options',
      header: 'Options',
      cell: ({ row }) => {
        const quiz = row.original;
        return (
          <div className="text-xs text-muted-foreground">
            {quiz.options?.map((o, i) => (
              <span
                key={i}
                className={
                  String.fromCharCode(65 + i) === quiz.correct_option
                    ? 'text-green-600 font-medium'
                    : ''
                }
              >
                {String.fromCharCode(65 + i)}: {o}
                {i < quiz.options.length - 1 ? ' | ' : ''}
              </span>
            ))}
          </div>
        );
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
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Quizzes ({quizzes.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Quiz
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={quizzes}
        searchKey="question"
        searchPlaceholder="Search quizzes..."
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Quiz</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Question</label>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
              />
            </div>
            {form.options.map((opt, i) => (
              <div key={i}>
                <label className="block text-sm font-medium mb-1">
                  Option {String.fromCharCode(65 + i)}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant={form.correct_option === i ? 'default' : 'outline'}
                    size="sm"
                    className={
                      form.correct_option === i
                        ? 'bg-green-600 hover:bg-green-700'
                        : ''
                    }
                    onClick={() => setForm({ ...form, correct_option: i })}
                  >
                    Correct
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger>
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
                <label className="block text-sm font-medium mb-1">Points Reward</label>
                <Input
                  type="number"
                  value={form.points_reward}
                  onChange={(e) =>
                    setForm({ ...form, points_reward: parseInt(e.target.value, 10) || 0 })
                  }
                  min={1}
                  className="w-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Quiz</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
