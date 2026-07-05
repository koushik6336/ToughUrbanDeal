import { format, differenceInMilliseconds } from 'date-fns';
import { Link } from 'wouter';
import {
  useGetJob,
  useGetJobExecutions,
  useGetJobLogs,
  useRetryJob,
  getGetJobQueryKey,
  getGetJobExecutionsQueryKey,
  getGetJobLogsQueryKey,
  customFetch,
} from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, Terminal, Activity, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export default function JobDetail({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: job, isLoading: isLoadingJob } = useGetJob(jobId, { query: { queryKey: getGetJobQueryKey(jobId), enabled: !!jobId, refetchInterval: (query) => (query.state.data?.status === 'running' || query.state.data?.status === 'claimed' ? 3000 : false) } });
  const { data: executions, isLoading: isLoadingExec } = useGetJobExecutions(jobId, { query: { queryKey: getGetJobExecutionsQueryKey(jobId), enabled: !!jobId } });
  const { data: logs, isLoading: isLoadingLogs } = useGetJobLogs(jobId, { query: { queryKey: getGetJobLogsQueryKey(jobId), enabled: !!jobId, refetchInterval: 3000 } });

  // Fetch retry policy details if the job has one
  const { data: retryPolicy } = useQuery({
    queryKey: ['retry-policy', job?.retryPolicyId],
    queryFn: () => customFetch<any>(`/api/retry-policies`).then((policies: any[]) =>
      policies.find((p: any) => p.id === job?.retryPolicyId) ?? null
    ),
    enabled: !!job?.retryPolicyId,
  });

  const retryJob = useRetryJob();

  const handleRetry = () => {
    retryJob.mutate(
      { jobId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
          toast({ title: "Job scheduled for retry" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Retry failed", description: err.message })
      }
    );
  };

  if (isLoadingJob) {
    return <div className="p-8 max-w-5xl mx-auto space-y-6"><Skeleton className="h-48 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!job) {
    return <div className="p-8 text-center text-muted-foreground">Job not found</div>;
  }

  const isFinished = ['completed', 'failed', 'dead_letter'].includes(job.status);
  const canRetry = ['failed', 'dead_letter'].includes(job.status);

  // Compute the next retry delay for display
  let computedNextDelay: number | null = null;
  if (retryPolicy && job.status === 'queued' && job.attemptCount > 0) {
    const base = retryPolicy.baseDelayMs as number;
    const multiplier = parseFloat(retryPolicy.multiplier ?? '2.0');
    const attempt = job.attemptCount as number;
    if (retryPolicy.type === 'fixed') computedNextDelay = base;
    else if (retryPolicy.type === 'linear') computedNextDelay = base * attempt;
    else if (retryPolicy.type === 'exponential') computedNextDelay = base * Math.pow(multiplier, attempt);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{job.id.split('-')[0]}</h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              {job.type} &bull; Queue: <Link href={`/queues/${job.queueId}`} className="text-primary hover:underline">{job.queueId}</Link>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {canRetry && (
            <Button onClick={handleRetry} disabled={retryJob.isPending}>
              <RefreshCw className={cn("mr-2 h-4 w-4", retryJob.isPending && "animate-spin")} />
              Retry Job
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metadata */}
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Job ID</span>
                <p className="font-mono text-sm break-all">{job.id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Run At</span>
                <p className="text-sm">{format(new Date(job.runAt), 'PPpp')}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Priority</span>
                <p className="text-sm">{job.priority}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Attempts</span>
                <p className="text-sm">{job.attemptCount} / {job.maxAttempts}</p>
              </div>
              {job.workerId && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Worker</span>
                  <p className="font-mono text-sm break-all">{job.workerId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retry Strategy Card */}
          <Card className={cn(
            "border",
            job.attemptCount > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-border"
          )}>
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Retry Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Attempts Used</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: job.maxAttempts as number }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2 w-6 rounded-sm",
                          i < (job.attemptCount as number)
                            ? "bg-amber-500"
                            : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">
                    {job.attemptCount}/{job.maxAttempts}
                  </span>
                </div>
              </div>

              {retryPolicy ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Strategy</span>
                    <p className="text-sm capitalize font-medium">{retryPolicy.type}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Base Delay</span>
                    <p className="text-sm font-mono">{formatDelay(retryPolicy.baseDelayMs)}</p>
                  </div>
                  {retryPolicy.type === 'exponential' && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Multiplier</span>
                      <p className="text-sm font-mono">×{retryPolicy.multiplier}</p>
                    </div>
                  )}
                  {computedNextDelay !== null && (
                    <div className="space-y-1 pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Next Retry In</span>
                      <p className="text-sm font-mono text-amber-500">{formatDelay(computedNextDelay)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Strategy</span>
                  <p className="text-sm text-muted-foreground">
                    {job.retryPolicyId ? 'Loading...' : 'Default (Exponential, 1s base)'}
                  </p>
                </div>
              )}

              {job.status === 'queued' && job.attemptCount > 0 && job.runAt && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Retry Scheduled</span>
                  <p className="text-sm font-mono text-amber-500">{format(new Date(job.runAt), 'PPpp')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono text-muted-foreground">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Execution History & Logs */}
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="executions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="executions"><Activity className="w-4 h-4 mr-2" /> Execution History</TabsTrigger>
              <TabsTrigger value="logs"><Terminal className="w-4 h-4 mr-2" /> Application Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="executions" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {isLoadingExec ? (
                    <div className="p-6"><Skeleton className="h-24 w-full" /></div>
                  ) : !executions?.length ? (
                    <div className="p-8 text-center text-muted-foreground">No execution history available</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {executions.map((exec) => {
                        const isSuccess = exec.status === 'completed';
                        const isRunning = exec.status === 'running';
                        const Icon = isSuccess ? CheckCircle2 : isRunning ? Activity : XCircle;
                        const duration = exec.startedAt && exec.finishedAt
                          ? `${differenceInMilliseconds(new Date(exec.finishedAt), new Date(exec.startedAt))}ms`
                          : '-';

                        return (
                          <div key={exec.id} className="p-4 hover:bg-muted/20 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "mt-1",
                                isSuccess ? "text-emerald-500" : isRunning ? "text-amber-500 animate-pulse" : "text-destructive"
                              )}>
                                <Icon size={20} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-semibold text-sm">Attempt #{exec.attemptNumber}</h4>
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Worker: {exec.workerId || 'unknown'}</p>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={isSuccess ? "success" : isRunning ? "warning" : "danger"} className="mb-1">
                                      {exec.status}
                                    </Badge>
                                    <div className="flex items-center text-xs text-muted-foreground justify-end gap-1">
                                      <Clock size={12} /> {duration}
                                    </div>
                                  </div>
                                </div>

                                {exec.errorMessage && (
                                  <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-xs font-mono text-destructive break-words">
                                    {exec.errorMessage}
                                  </div>
                                )}

                                {exec.result && Object.keys(exec.result).length > 0 && (
                                  <div className="bg-muted/50 rounded p-3">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Result</p>
                                    <pre className="text-xs font-mono break-words whitespace-pre-wrap">
                                      {JSON.stringify(exec.result, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <Card className="bg-[#0f111a] border-[#1f2937]">
                <CardHeader className="py-3 px-4 border-b border-[#1f2937] flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-mono text-[#a3b1c6]">container_output.log</CardTitle>
                  {!isFinished && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-xs text-muted-foreground">Tailing...</span></div>}
                </CardHeader>
                <CardContent className="p-0 overflow-hidden">
                  <div className="h-[500px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                    {isLoadingLogs ? (
                      <Skeleton className="h-4 w-full bg-white/5" />
                    ) : !logs?.length ? (
                      <div className="text-[#64748b] italic">No logs emitted during execution.</div>
                    ) : (
                      logs.map((log) => {
                        const color =
                          log.logLevel === 'error' ? 'text-red-400' :
                          log.logLevel === 'warn' ? 'text-yellow-400' :
                          'text-[#94a3b8]';

                        return (
                          <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded -mx-2">
                            <span className="text-[#475569] shrink-0">{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss.SSS') : '--:--:--.---'}</span>
                            <span className={cn("uppercase w-10 shrink-0 font-bold", color)}>{log.logLevel}</span>
                            <span className="text-[#e2e8f0] break-words flex-1 whitespace-pre-wrap">{log.message}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
