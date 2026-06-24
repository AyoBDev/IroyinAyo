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
  Clock,
  Megaphone,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/control-center', label: 'Control Center', icon: Gauge },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/quizzes', label: 'Quizzes', icon: Brain },
  { href: '/markets', label: 'Markets', icon: TrendingUp },
  { href: '/schedules', label: 'Schedules', icon: Clock },
  { href: '/ambassadors', label: 'Ambassadors', icon: Megaphone },
  { href: '/broadcast', label: 'Broadcast', icon: Megaphone },
  { href: '/rewards', label: 'Rewards', icon: Gift },
];

function Sidebar() {
  const { admin, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-[#10B981]" strokeWidth={2.5} />
          <span className="font-[800] text-[17px] tracking-[-0.5px]" style={{ fontFamily: 'Satoshi, sans-serif' }}>IroyinMarket</span>
        </div>
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

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
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
