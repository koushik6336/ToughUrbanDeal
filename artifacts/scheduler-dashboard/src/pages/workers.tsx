import { formatDistanceToNow } from 'date-fns';
import { useListWorkers, getListWorkersQueryKey } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ServerCog, Activity, Cpu, Database, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function WorkerStatusBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    active: { variant: 'success', label: 'Active' },
    draining: { variant: 'warning', label: 'Draining' },
    dead: { variant: 'danger', label: 'Dead' },
  };
  const config = map[status] || { variant: 'default', label: status };
  return <Badge variant={config.variant as any}>{config.label}</Badge>;
}

export default function Workers() {
  const { data: workers, isLoading, refetch, isRefetching } = useListWorkers({ query: { queryKey: getListWorkersQueryKey(), refetchInterval: 5000 } });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Worker Fleet</h1>
          <p className="text-muted-foreground mt-1">Monitor the health and capacity of connected execution nodes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : workers?.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <ServerCog className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No workers connected</h3>
            <p className="text-muted-foreground mb-4 mt-1 max-w-sm">
              Start a worker process to begin consuming background jobs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workers?.map((worker) => {
            const isDead = worker.status === 'dead';
            
            return (
              <Card key={worker.id} className={isDead ? "opacity-70 grayscale" : ""}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isDead ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                      <ServerCog size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-mono">{worker.name}</CardTitle>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[120px]" title={worker.id}>
                        {worker.id.split('-')[0]}
                      </div>
                    </div>
                  </div>
                  <WorkerStatusBadge status={worker.status} />
                </CardHeader>
                <CardContent>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-border pt-4">
                    <div>
                      <div className="flex items-center justify-center text-muted-foreground mb-1">
                        <Activity size={14} className="mr-1" />
                        <span className="text-xs uppercase">Jobs</span>
                      </div>
                      <span className="font-mono text-lg font-medium">{isDead ? '-' : '0'}</span> {/* Active jobs would come from heartbeat stats */}
                    </div>
                    <div>
                      <div className="flex items-center justify-center text-muted-foreground mb-1">
                        <Cpu size={14} className="mr-1" />
                        <span className="text-xs uppercase">CPU</span>
                      </div>
                      <span className="font-mono text-lg font-medium">{isDead ? '-' : '-%'}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-center text-muted-foreground mb-1">
                        <Database size={14} className="mr-1" />
                        <span className="text-xs uppercase">RAM</span>
                      </div>
                      <span className="font-mono text-lg font-medium">{isDead ? '-' : '-%'}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] text-muted-foreground flex justify-between bg-muted/50 p-2 rounded">
                    <span>Seen: {worker.lastHeartbeatAt ? formatDistanceToNow(new Date(worker.lastHeartbeatAt), { addSuffix: true }) : 'Never'}</span>
                    <span>Up: {worker.registeredAt ? formatDistanceToNow(new Date(worker.registeredAt)) : 'Unknown'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
