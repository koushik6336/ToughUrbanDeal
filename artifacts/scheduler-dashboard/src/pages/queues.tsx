import { Link, useSearch } from 'wouter';
import { useListQueues, useCreateQueue, getListQueuesQueryKey, useGetQueueStats, getGetQueueStatsQueryKey } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Plus, ArrowLeft, Activity, PauseCircle, PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function QueueStatsCard({ queueId }: { queueId: string }) {
  const { data: stats } = useGetQueueStats(queueId, { query: { queryKey: getGetQueueStatsQueryKey(queueId), refetchInterval: 5000 } });

  if (!stats) {
    return <div className="h-10 animate-pulse bg-muted rounded mt-4" />;
  }

  return (
    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
      <div className="bg-muted/50 rounded-md p-2">
        <div className="font-mono text-lg text-foreground font-medium">{stats.queued}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Queued</div>
      </div>
      <div className="bg-amber-500/10 rounded-md p-2">
        <div className="font-mono text-lg text-amber-500 font-medium">{stats.running}</div>
        <div className="text-xs text-amber-500/70 uppercase tracking-wider">Running</div>
      </div>
      <div className="bg-emerald-500/10 rounded-md p-2">
        <div className="font-mono text-lg text-emerald-500 font-medium">{stats.completed}</div>
        <div className="text-xs text-emerald-500/70 uppercase tracking-wider">Done</div>
      </div>
      <div className="bg-destructive/10 rounded-md p-2">
        <div className="font-mono text-lg text-destructive font-medium">{stats.failed}</div>
        <div className="text-xs text-destructive/70 uppercase tracking-wider">Failed</div>
      </div>
    </div>
  );
}

export default function Queues() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const projectId = params.get('projectId') || '';
  
  const { data: queues, isLoading } = useListQueues({ projectId }, { query: { queryKey: getListQueuesQueryKey({ projectId }), enabled: !!projectId } });
  const createQueue = useCreateQueue();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', priority: 10, concurrencyLimit: 100 });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !projectId) return;
    
    createQueue.mutate(
      { data: { projectId, name: formData.name, priority: formData.priority, concurrencyLimit: formData.concurrencyLimit } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQueuesQueryKey({ projectId }) });
          setOpen(false);
          setFormData({ name: '', priority: 10, concurrencyLimit: 100 });
          toast({ title: "Queue created successfully" });
        },
        onError: (err: any) => {
          toast({ 
            variant: "destructive", 
            title: "Failed to create queue",
            description: err.message 
          });
        }
      }
    );
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-bold mb-2">Project ID missing</h2>
        <p className="text-muted-foreground mb-4">Please select a project first.</p>
        <Link href="/orgs">
          <Button><ArrowLeft className="mr-2 h-4 w-4" /> Go to Organizations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Queues</h1>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Manage task execution pipelines and throughput limits.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Queue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Queue</DialogTitle>
                <DialogDescription>
                  Define a new execution pipeline for async jobs.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} 
                    placeholder="e.g. send-emails" 
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority (lower is higher)</Label>
                    <Input 
                      id="priority" 
                      type="number"
                      value={formData.priority} 
                      onChange={(e) => setFormData(p => ({...p, priority: Number(e.target.value)}))} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="concurrency">Concurrency Limit</Label>
                    <Input 
                      id="concurrency" 
                      type="number"
                      value={formData.concurrencyLimit} 
                      onChange={(e) => setFormData(p => ({...p, concurrencyLimit: Number(e.target.value)}))} 
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createQueue.isPending || !formData.name.trim()}>
                  {createQueue.isPending ? "Creating..." : "Create Queue"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : queues?.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Layers className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No queues configured</h3>
            <p className="text-muted-foreground mb-4 mt-1 max-w-sm">
              Define your first task pipeline to start processing background jobs.
            </p>
            <Button onClick={() => setOpen(true)}>Create Queue</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {queues?.map((queue) => (
            <Link key={queue.id} href={`/queues/${queue.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-secondary/50 flex items-center justify-center text-secondary-foreground">
                        <Layers size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{queue.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {queue.isPaused ? (
                            <Badge variant="warning" className="text-[10px] h-5 px-1.5"><PauseCircle className="mr-1 w-3 h-3" /> Paused</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px] h-5 px-1.5"><PlayCircle className="mr-1 w-3 h-3" /> Active</Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">Pri: {queue.priority}</span>
                          <span className="text-xs text-muted-foreground font-mono">&bull; Max: {queue.concurrencyLimit}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors -mt-1 -mr-2">
                      <Activity size={18} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto">
                  <QueueStatsCard queueId={queue.id} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
