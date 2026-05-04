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
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0" />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
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
