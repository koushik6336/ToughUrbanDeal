import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard,
  Building2,
  ServerCog,
  Ghost,
  LogOut,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, logout } = useAuth();

  const navigation = [
    { name: 'Metrics', href: '/metrics', icon: Activity },
    { name: 'Organizations', href: '/orgs', icon: Building2 },
    { name: 'Workers', href: '/workers', icon: ServerCog },
    { name: 'Dead Letters', href: '/dlq', icon: Ghost },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              <LayoutDashboard size={18} />
            </div>
            <span className="font-bold tracking-tight text-sidebar-foreground">JobOps Console</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="w-24 h-3" />
                <Skeleton className="w-32 h-3" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{user?.name || 'Engineer'}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
