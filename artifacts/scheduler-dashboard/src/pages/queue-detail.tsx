import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { 
  useGetQueue, 
  useGetQueueStats,
  useListJobs,
  useUpdateQueue,
  usePauseQueue,
  useResumeQueue,
  getGetQueueQueryKey,
  getGetQueueStatsQueryKey,
  getListJobsQueryKey
} from '@workspace/api-client-react';
import { keepPreviousData } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  ArrowLeft, PauseCircle, PlayCircle, Settings2, RefreshCcw, Search, Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    queued: { variant: 'secondary', label: 'Queued' },
    scheduled: { variant: 'outline', label: 'Scheduled' },
    claimed: { variant: 'warning', label: 'Claimed' },
    running: { variant: 'warning', label: 'Running' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'danger', label: 'Failed' },
    dead_letter: { variant: 'destructive', label: 'Dead Letter' },
  };
  const config = map[status] || { variant: 'default', label: status };
  
  return <Badge variant={config.variant as any}>{config.label}</Badge>;
}

export default function QueueDetail({ params }: { params: { queueId: string } }) {
  const { queueId } = params;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data: queue, isLoading: isLoadingQueue } = useGetQueue(queueId, { query: { queryKey: getGetQueueQueryKey(queueId), enabled: !!queueId } });
  const { data: stats } = useGetQueueStats(queueId, { query: { queryKey: getGetQueueStatsQueryKey(queueId), enabled: !!queueId, refetchInterval: 5000 } });
  
  const jobStatusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: jobsData, isLoading: isLoadingJobs, refetch: refetchJobs, isRefetching } = useListJobs(
    { queueId, status: jobStatusFilter, page, limit },
    { query: { queryKey: getListJobsQueryKey({ queueId, status: jobStatusFilter, page, limit }), enabled: !!queueId, placeholderData: keepPreviousData } }
  );

  const updateQueue = useUpdateQueue();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formData, setFormData] = useState({ priority: 10, concurrencyLimit: 100 });

  const handleOpenSettings = () => {
    if (queue) {
      setFormData({ priority: queue.priority, concurrencyLimit: queue.concurrencyLimit });
      setSettingsOpen(true);
    }
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueue.mutate(
      { queueId, data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey(queueId) });
          setSettingsOpen(false);
          toast({ title: "Queue settings updated" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
      }
    );
  };

  const togglePause = () => {
    if (!queue) return;
    const mutation = queue.isPaused ? resumeQueue : pauseQueue;
    mutation.mutate(
      { queueId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey(queueId) });
          toast({ title: queue.isPaused ? "Queue resumed" : "Queue paused" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
      }
    );
  };

  if (isLoadingQueue) {
    return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!queue) {
    return <div className="p-8 text-center text-muted-foreground">Queue not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{queue.name}</h1>
              {queue.isPaused ? (
                <Badge variant="warning"><PauseCircle className="mr-1 w-3 h-3" /> Paused</Badge>
              ) : (
                <Badge variant="success"><PlayCircle className="mr-1 w-3 h-3" /> Active</Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              id: {queue.id} | proj: {queue.projectId}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={queue.isPaused ? "default" : "secondary"} 
            onClick={togglePause}
            disabled={pauseQueue.isPending || resumeQueue.isPending}
          >
            {queue.isPaused ? <><PlayCircle className="mr-2 h-4 w-4" /> Resume Queue</> : <><PauseCircle className="mr-2 h-4 w-4" /> Pause Queue</>}
          </Button>
          
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleOpenSettings}>
                <Settings2 className="mr-2 h-4 w-4" /> Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleUpdateSettings}>
                <DialogHeader>
                  <DialogTitle>Queue Configuration</DialogTitle>
                  <DialogDescription>Update throughput limits and priority.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority (lower is higher)</Label>
                    <Input id="priority" type="number" value={formData.priority} onChange={e => setFormData(p => ({...p, priority: Number(e.target.value)}))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="concurrency">Concurrency Limit</Label>
                    <Input id="concurrency" type="number" value={formData.concurrencyLimit} onChange={e => setFormData(p => ({...p, concurrencyLimit: Number(e.target.value)}))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateQueue.isPending}>Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium">{stats?.total ?? '-'}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Jobs</span>
          </CardContent>
        </Card>
        <Card className="bg-muted/5">
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium">{stats?.queued ?? '-'}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Queued</span>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium text-amber-500">{stats?.running ?? '-'}</span>
            <span className="text-xs text-amber-500/70 uppercase tracking-wider mt-1">Running</span>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium text-emerald-500">{stats?.completed ?? '-'}</span>
            <span className="text-xs text-emerald-500/70 uppercase tracking-wider mt-1">Completed</span>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium text-destructive">{stats?.failed ?? '-'}</span>
            <span className="text-xs text-destructive/70 uppercase tracking-wider mt-1">Failed</span>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-3xl font-mono font-medium text-destructive">{stats?.deadLetter ?? '-'}</span>
            <span className="text-xs text-destructive/80 uppercase tracking-wider mt-1">Dead Letter</span>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle>Jobs Pipeline</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => refetchJobs()} disabled={isRefetching}>
            <RefreshCcw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }} className="w-full">
          <div className="px-6 border-b border-border">
            <TabsList className="bg-transparent space-x-2 h-10 w-full justify-start overflow-x-auto p-0 rounded-none border-0">
              <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none px-4">All</TabsTrigger>
              <TabsTrigger value="queued" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none px-4">Queued</TabsTrigger>
              <TabsTrigger value="running" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none shadow-none px-4">Running</TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none shadow-none px-4">Completed</TabsTrigger>
              <TabsTrigger value="failed" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-destructive rounded-none shadow-none px-4">Failed</TabsTrigger>
              <TabsTrigger value="dead_letter" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-destructive rounded-none shadow-none px-4">Dead Letter</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-0">
            {isLoadingJobs ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !jobsData?.data.length ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Search className="h-10 w-10 text-muted-foreground opacity-30 mb-4" />
                <p className="text-lg font-medium">No jobs found</p>
                <p className="text-muted-foreground mt-1">There are no jobs matching the current filter.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID / Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Run At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsData.data.map(job => (
                    <TableRow key={job.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-primary">{job.id.split('-')[0]}</span>
                          <span className="font-medium text-sm">{job.type}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={job.status} /></TableCell>
                      <TableCell className="font-mono text-sm">
                        {job.attemptCount} / {job.maxAttempts}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(new Date(job.runAt), 'MMM d, HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">Inspect</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Pagination */}
            {jobsData && jobsData.total > limit && (
              <div className="flex items-center justify-between border-t border-border px-6 py-3">
                <span className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, jobsData.total)} of {jobsData.total}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page * limit >= jobsData.total} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
