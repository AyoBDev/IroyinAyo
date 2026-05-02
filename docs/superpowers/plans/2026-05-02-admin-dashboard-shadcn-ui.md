# Admin Dashboard shadcn/ui Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all raw Tailwind CSS styling in the Iroyinayo admin dashboard with shadcn/ui components and a dark theme.

**Architecture:** Install shadcn/ui with dark mode defaults, create reusable DataTable and StatCard components, then refactor all 7 pages to use shadcn/ui primitives. No business logic or API changes — pure UI layer swap.

**Tech Stack:** Next.js 16, React 19, shadcn/ui v2, Tailwind CSS v4, @tanstack/react-table, lucide-react

**Important:** This project uses Next.js 16 with breaking changes. Before writing any code, read the relevant guide in `node_modules/next/dist/docs/` to verify API conventions. The project uses `.js` extensions (not `.tsx`), `jsconfig.json` (not `tsconfig.json`), and the App Router.

---

### Task 1: Install dependencies and initialize shadcn/ui

**Files:**
- Modify: `iroyinayo-admin/package.json`
- Create: `iroyinayo-admin/src/lib/utils.js`
- Modify: `iroyinayo-admin/src/app/globals.css`
- Modify: `iroyinayo-admin/jsconfig.json`
- Create: `iroyinayo-admin/components.json`

- [ ] **Step 1: Install core dependencies**

Run from `iroyinayo-admin/`:
```bash
npm install clsx tailwind-merge class-variance-authority lucide-react @tanstack/react-table
```

- [ ] **Step 2: Create the `cn()` utility**

Create `src/lib/utils.js`:
```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Initialize shadcn/ui**

Run from `iroyinayo-admin/`:
```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

This will update `globals.css` with CSS variable definitions and create `components.json`.

**Note:** shadcn/ui may generate TypeScript files by default. If it does, you'll need to rename `.tsx` → `.js` and remove type annotations from generated component files. Check the generated `components.json` and set `"tsx": false` if that option exists.

- [ ] **Step 4: Configure dark mode as default**

After shadcn init, modify `globals.css` so the dark theme values are the defaults. The file will have both `:root` and `.dark` blocks after init. Move the `.dark` values into `:root` and remove the `.dark` block. Keep the `@import "tailwindcss"` at the top.

The result should look like (exact values may vary based on shadcn version — use whatever shadcn generates for `.dark` as your `:root`):

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 5: Update layout.js to apply dark class**

Modify `src/app/layout.js`:
```javascript
import './globals.css';
import { ClientLayout } from './client-layout';

export const metadata = {
  title: 'Iroyinayo Admin',
  description: 'Admin dashboard for Iroyinayo WhatsApp bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Install all needed shadcn/ui components**

Run each from `iroyinayo-admin/`:
```bash
npx shadcn@latest add button card input label select textarea table dialog sheet badge dropdown-menu separator
```

Do NOT install the `sidebar` component — the plan uses `Button` variants for nav items instead of the full shadcn Sidebar.

```
```

If generated files are `.tsx`, rename them to `.js` and strip type annotations.

- [ ] **Step 7: Verify the build compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors. Fix any import path issues.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Set up shadcn/ui with dark theme, install all UI components"
```

---

### Task 2: Create reusable DataTable component

**Files:**
- Create: `iroyinayo-admin/src/components/data-table.jsx`

- [ ] **Step 1: Create the DataTable component**

Create `src/components/data-table.jsx`:
```javascript
'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

export function DataTable({ columns, data, searchKey, searchPlaceholder }) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div>
      {searchKey && (
        <div className="flex items-center py-4">
          <Input
            placeholder={searchPlaceholder || `Search...`}
            value={table.getColumn(searchKey)?.getFilterValue() ?? ''}
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="max-w-sm"
          />
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SortableHeader({ column, children }) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table.jsx
git commit -m "Add reusable DataTable component with sorting, filtering, pagination"
```

---

### Task 3: Create StatCard component

**Files:**
- Create: `iroyinayo-admin/src/components/stat-card.jsx`

- [ ] **Step 1: Create the StatCard component**

Create `src/components/stat-card.jsx`:
```javascript
import { Card, CardContent } from '@/components/ui/card';

export function StatCard({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stat-card.jsx
git commit -m "Add StatCard component wrapping shadcn Card"
```

---

### Task 4: Refactor layout and sidebar

**Files:**
- Modify: `iroyinayo-admin/src/app/client-layout.js`

- [ ] **Step 1: Rewrite client-layout.js with shadcn components and lucide icons**

Replace the entire contents of `src/app/client-layout.js`:
```javascript
'use client';

import { AuthProvider, useAuth } from '../lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  FileText,
  Brain,
  TrendingUp,
  Gift,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/quizzes', label: 'Quizzes', icon: Brain },
  { href: '/markets', label: 'Markets', icon: TrendingUp },
  { href: '/rewards', label: 'Rewards', icon: Gift },
];

function Sidebar() {
  const { admin, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-4">
        <h1 className="text-lg font-bold">Iroyinayo</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {admin?.name} ({admin?.role})
        </p>
      </div>
      <Separator />
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start gap-2 mb-1')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

function AuthGate({ children }) {
  const { admin, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!admin && pathname !== '/login') {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

export function ClientLayout({ children }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/client-layout.js
git commit -m "Refactor sidebar layout with shadcn Button, Separator, lucide icons"
```

---

### Task 5: Refactor Login page

**Files:**
- Modify: `iroyinayo-admin/src/app/login/page.js`

- [ ] **Step 1: Rewrite login page with shadcn components**

Replace the entire contents of `src/app/login/page.js`:
```javascript
'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Iroyinayo Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.js
git commit -m "Refactor login page with shadcn Card, Input, Label, Button"
```

---

### Task 6: Refactor Dashboard page

**Files:**
- Modify: `iroyinayo-admin/src/app/page.js`

- [ ] **Step 1: Rewrite dashboard page with StatCard and shadcn Table**

Replace the entire contents of `src/app/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [analytics, leaders] = await Promise.all([
          api.get('/admin/analytics'),
          api.get('/gamification/leaderboard?period=weekly'),
        ]);
        setStats(analytics);
        setLeaderboard(leaders);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="text-destructive">Error: {error}</div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Students" value={stats?.total_students} />
        <StatCard label="Active Today" value={stats?.active_today} />
        <StatCard label="Points Issued" value={stats?.total_points_issued} />
        <StatCard label="Total Redemptions" value={stats?.total_redemptions} />
        <StatCard label="Pending Redemptions" value={stats?.pending_redemptions} />
        <StatCard label="Open Markets" value={stats?.open_markets} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(entry.total_points)}
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
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "Refactor dashboard page with StatCard and shadcn Table"
```

---

### Task 7: Refactor Students page

**Files:**
- Modify: `iroyinayo-admin/src/app/students/page.js`

- [ ] **Step 1: Rewrite students page with DataTable, Sheet, Badge, DropdownMenu**

Replace the entire contents of `src/app/students/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { MoreHorizontal } from 'lucide-react';

export default function StudentsPage() {
  const { hasRole } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmBan, setConfirmBan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      const data = await api.get('/students?limit=1000');
      setStudents(data.students);
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewStudent(id) {
    try {
      const student = await api.get(`/students/${id}`);
      const history = await api.get(`/gamification/points/${id}/history`);
      setSelected({ ...student, history });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleBan(student) {
    try {
      const endpoint = student.is_banned
        ? `/admin/students/${student.id}/unban`
        : `/admin/students/${student.id}/ban`;
      await api.post(endpoint);
      setConfirmBan(null);
      loadStudents();
      if (selected?.id === student.id) {
        setSelected({ ...selected, is_banned: !student.is_banned });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
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
      accessorKey: 'phone_number',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue('phone_number')}
        </span>
      ),
    },
    {
      accessorKey: 'level',
      header: 'Level',
      cell: ({ row }) => row.getValue('level') || '—',
    },
    {
      accessorKey: 'points_balance',
      header: ({ column }) => (
        <SortableHeader column={column}>Points</SortableHeader>
      ),
    },
    {
      accessorKey: 'is_banned',
      header: 'Status',
      cell: ({ row }) =>
        row.getValue('is_banned') ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
        ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const student = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => viewStudent(student.id)}>
                View Details
              </DropdownMenuItem>
              {hasRole('super_admin', 'moderator') && (
                <DropdownMenuItem
                  onClick={() => setConfirmBan(student)}
                  className={student.is_banned ? '' : 'text-destructive'}
                >
                  {student.is_banned ? 'Unban' : 'Ban'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Students ({students.length})
      </h1>

      <DataTable
        columns={columns}
        data={students}
        searchKey="name"
        searchPlaceholder="Search students..."
      />

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 text-sm mt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{selected?.phone_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Faculty</span>
              <span>{selected?.faculty || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level</span>
              <span>{selected?.level || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Points</span>
              <span>{selected?.points_balance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interests</span>
              <span>{selected?.interests?.join(', ') || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {selected?.is_banned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : (
                <Badge className="bg-green-600">Active</Badge>
              )}
            </div>
          </div>

          {selected?.history?.length > 0 && (
            <>
              <Separator className="my-4" />
              <h3 className="font-medium text-sm mb-2">Recent Activity</h3>
              <div className="space-y-1 text-xs">
                {selected.history.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tx.description || tx.type}
                    </span>
                    <span
                      className={
                        tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmBan} onOpenChange={() => setConfirmBan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmBan?.is_banned ? 'Unban' : 'Ban'} Student
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to{' '}
              {confirmBan?.is_banned ? 'unban' : 'ban'}{' '}
              <strong>{confirmBan?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBan(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmBan?.is_banned ? 'default' : 'destructive'}
              onClick={() => toggleBan(confirmBan)}
            >
              {confirmBan?.is_banned ? 'Unban' : 'Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Note:** The DataTable now handles pagination client-side. We fetch all students at once (`limit=1000`) and let @tanstack/react-table handle sorting, filtering, and pagination. If the dataset is too large for this, the server-side pagination can be re-added later.

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/students/page.js
git commit -m "Refactor students page with DataTable, Sheet, Badge, DropdownMenu"
```

---

### Task 8: Refactor Content page

**Files:**
- Modify: `iroyinayo-admin/src/app/content/page.js`

- [ ] **Step 1: Rewrite content page with DataTable, Dialog, Badge, DropdownMenu**

Replace the entire contents of `src/app/content/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
              <Badge className="bg-purple-600 hover:bg-purple-700">AI</Badge>
            )}
            {item.is_broadcast && (
              <Badge className="bg-yellow-600 hover:bg-yellow-700">broadcast</Badge>
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
        if (item.is_published) return <Badge className="bg-green-600 hover:bg-green-700">Published</Badge>;
        if (item.is_approved) return <Badge className="bg-blue-600 hover:bg-blue-700">Approved</Badge>;
        return <Badge className="bg-yellow-600 hover:bg-yellow-700">Pending</Badge>;
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
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!item.is_approved && (
                <DropdownMenuItem onClick={() => handleApprove(item.id)}>
                  Approve
                </DropdownMenuItem>
              )}
              {!item.is_published && item.is_approved && (
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Content ({items.length})</h1>
        <div className="flex gap-2">
          <Select value={genCategory} onValueChange={setGenCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="secondary"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generating ? 'Generating...' : 'AI Generate'}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Content</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={form.categories.includes(cat) ? 'default' : 'outline'}
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
                className="rounded"
              />
              <Label htmlFor="broadcast">Broadcast to all students</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Content</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/content/page.js
git commit -m "Refactor content page with DataTable, Dialog, Badge, DropdownMenu"
```

---

### Task 9: Refactor Quizzes page

**Files:**
- Modify: `iroyinayo-admin/src/app/quizzes/page.js`

- [ ] **Step 1: Rewrite quizzes page with DataTable and Dialog**

Replace the entire contents of `src/app/quizzes/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
      await api.post('/gamification/quizzes', form);
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
      accessorKey: 'options',
      header: 'Options',
      cell: ({ row }) => {
        const quiz = row.original;
        return (
          <div className="text-xs text-muted-foreground">
            {quiz.options?.map((o, i) => (
              <span
                key={i}
                className={
                  i === quiz.correct_option
                    ? 'text-green-500 font-medium'
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quizzes ({quizzes.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Quiz</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
              />
            </div>
            {form.options.map((opt, i) => (
              <div key={i} className="space-y-1">
                <Label>
                  Option {String.fromCharCode(65 + i)}
                  {form.correct_option === i && (
                    <span className="text-green-500 ml-2">(correct)</span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={form.correct_option === i ? 'default' : 'outline'}
                    className={form.correct_option === i ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setForm({ ...form, correct_option: i })}
                  >
                    Correct
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points Reward</Label>
                <Input
                  id="points"
                  type="number"
                  value={form.points_reward}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      points_reward: parseInt(e.target.value, 10) || 0,
                    })
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
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/quizzes/page.js
git commit -m "Refactor quizzes page with DataTable, Dialog, Select, Badge"
```

---

### Task 10: Refactor Markets page

**Files:**
- Modify: `iroyinayo-admin/src/app/markets/page.js`

- [ ] **Step 1: Rewrite markets page with DataTable, Dialog, Badge, DropdownMenu**

Replace the entire contents of `src/app/markets/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus } from 'lucide-react';

const MARKET_CATEGORIES = ['campus_news', 'sports', 'entertainment', 'academic', 'tech'];

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

  function getStatusBadge(market) {
    if (market.status === 'resolved') {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Resolved ({market.outcome})</Badge>;
    }
    if (!market.is_approved) {
      return <Badge className="bg-yellow-600 hover:bg-yellow-700">Pending</Badge>;
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
      header: 'Yes / No',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="text-xs">
            <span className="text-green-500">{(m.yes_price * 100).toFixed(0)}%</span>
            {' / '}
            <span className="text-red-500">{(m.no_price * 100).toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      id: 'pool',
      header: 'Pool',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="text-xs text-muted-foreground">
            {m.yes_pool + m.no_pool} pts
            {m.sponsor_bonus > 0 && (
              <span className="text-yellow-500 ml-1">(+{m.sponsor_bonus} bonus)</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original),
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
        const hasActions = !m.is_approved || (m.status === 'open' && m.is_approved);
        if (!hasActions) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!m.is_approved && (
                <DropdownMenuItem onClick={() => handleApprove(m.id)}>
                  Approve
                </DropdownMenuItem>
              )}
              {m.status === 'open' && m.is_approved && (
                <DropdownMenuItem onClick={() => setResolveModal(m)}>
                  Resolve
                </DropdownMenuItem>
              )}
              {m.status === 'open' && m.is_approved && (
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Markets ({markets.length})</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Market</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mkt-question">Question</Label>
              <Input
                id="mkt-question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
                placeholder="Will ASUU call off the strike before June?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mkt-desc">Description</Label>
              <Textarea
                id="mkt-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closes">Closes At</Label>
                <Input
                  id="closes"
                  type="datetime-local"
                  value={form.closes_at}
                  onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor">Sponsor Bonus</Label>
                <Input
                  id="sponsor"
                  type="number"
                  value={form.sponsor_bonus}
                  onChange={(e) => setForm({ ...form, sponsor_bonus: parseInt(e.target.value, 10) || 0 })}
                  min={0}
                  className="w-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Market</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Market Dialog */}
      <Dialog open={!!resolveModal} onOpenChange={() => setResolveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Market</DialogTitle>
            <DialogDescription>{resolveModal?.question}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleResolve(resolveModal.id, 'yes')}
            >
              YES
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
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
      <Dialog open={!!sponsorModal} onOpenChange={() => { setSponsorModal(null); setSponsorAmount(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sponsor Market</DialogTitle>
            <DialogDescription>{sponsorModal?.question}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sponsor-amount">Bonus Points</Label>
            <Input
              id="sponsor-amount"
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
            <Button
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={() => handleSponsor(sponsorModal.id)}
            >
              Add Sponsor Bonus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/markets/page.js
git commit -m "Refactor markets page with DataTable, Dialog, Badge, DropdownMenu"
```

---

### Task 11: Refactor Rewards page

**Files:**
- Modify: `iroyinayo-admin/src/app/rewards/page.js`

- [ ] **Step 1: Rewrite rewards page with two DataTables, Dialog, Badge**

Replace the entire contents of `src/app/rewards/page.js`:
```javascript
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataTable, SortableHeader } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  const [confirmFulfill, setConfirmFulfill] = useState(null);
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
      setConfirmFulfill(null);
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
          <Badge className={type === 'airtime' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}>
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
      cell: ({ row }) => `${row.getValue('points_cost')} pts`,
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
        return <span className="font-medium">{r.student_name || r.student_id}</span>;
      },
    },
    {
      accessorKey: 'reward_name',
      header: 'Reward',
      cell: ({ row }) => {
        const r = row.original;
        return r.reward_name || r.reward_option_id;
      },
    },
    {
      accessorKey: 'phone_number',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue('phone_number') || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Date</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {new Date(row.getValue('created_at')).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setConfirmFulfill(r)}>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rewards</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
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
          <DataTable columns={optionColumns} data={options} searchKey="name" searchPlaceholder="Search rewards..." />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">
            Pending Redemptions ({pending.length})
          </h2>
          <DataTable columns={pendingColumns} data={pending} searchKey="student_name" searchPlaceholder="Search redemptions..." />
        </div>
      </div>

      {/* Create Reward Option Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Reward Option</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rw-name">Name</Label>
              <Input
                id="rw-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="MTN 500MB Data"
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(val) => setForm({ ...form, type: val })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airtime">Airtime</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rw-cost">Points Cost</Label>
                <Input
                  id="rw-cost"
                  type="number"
                  value={form.points_cost}
                  onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
                  required
                  min={1}
                  className="w-32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rw-value">Value</Label>
                <Input
                  id="rw-value"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  required
                  placeholder="N200 airtime"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Reward Option</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fulfill Confirmation Dialog */}
      <Dialog open={!!confirmFulfill} onOpenChange={() => setConfirmFulfill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fulfill Redemption</DialogTitle>
            <DialogDescription>
              Fulfill <strong>{confirmFulfill?.reward_name}</strong> for{' '}
              <strong>{confirmFulfill?.student_name || confirmFulfill?.student_id}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFulfill(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleFulfill(confirmFulfill.id)}
            >
              Fulfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/rewards/page.js
git commit -m "Refactor rewards page with two DataTables, Dialog, Badge, DropdownMenu"
```

---

### Task 12: Final build verification and cleanup

**Files:**
- All files in `iroyinayo-admin/src/`

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors that appear.

- [ ] **Step 3: Remove unused default public assets**

```bash
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

- [ ] **Step 4: Start dev server and verify pages load**

```bash
npm run dev
```

Manually check in browser:
- `/login` — dark card centered, form fields work
- `/` — dark dashboard with stat cards and leaderboard table
- `/students` — DataTable with search, sort, sheet slide-out, ban dialog
- `/content` — DataTable with search, create dialog, AI generate button
- `/quizzes` — DataTable with search, create dialog
- `/markets` — DataTable with search, create/resolve/sponsor dialogs
- `/rewards` — two DataTables with create dialog and fulfill confirmation

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "Remove unused default assets, final cleanup"
```
