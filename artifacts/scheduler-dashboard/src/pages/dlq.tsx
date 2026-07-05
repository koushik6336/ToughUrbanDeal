import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { 
  useListDeadLetterJobs, 
  useRequeueDeadLetter,
  getListDeadLetterJobsQueryKey
} from '@workspace/api-client-react';
import { keepPreviousData } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Ghost, RefreshCw, RefreshCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function DLQ() {
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: dlqPage, isLoading, refetch, isRefetching } = useListDeadLetterJobs(
    { page, limit },
    { query: { queryKey: getListDeadLetterJobsQueryKey({ page, limit }), placeholderData: keepPreviousData } }
  );

  const requeue = useRequeueDeadLetter();

  const handleRequeue = (id: string) => {
    requeue.mutate(
      { dlqId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeadLetterJobsQueryKey({ page, limit }) });
          toast({ title: "Job successfully requeued" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed to requeue", description: err.message });
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h1>
          <p className="text-muted-foreground mt-1">Inspect and recover jobs that exhausted their retry attempts.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !dlqPage?.data.length ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Ghost className="h-12 w-12 text-emerald-500/50 mb-4" />
              <p className="text-lg font-medium">DLQ is empty</p>
              <p className="text-muted-foreground mt-1">No jobs have permanently failed recently.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Original Job ID</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Failure Reason</TableHead>
                    <TableHead>Moved At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dlqPage.data.map(dlq => (
                    <TableRow key={dlq.id}>
                      <TableCell>
                        {dlq.originalJobId ? (
                          <Link href={`/jobs/${dlq.originalJobId}`} className="font-mono text-xs text-primary hover:underline">
                            {dlq.originalJobId.split('-')[0]}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {dlq.queueId.split('-')[0]}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-xs font-mono text-destructive" title={dlq.failureReason || 'Unknown'}>
                          {dlq.failureReason || 'Unknown error'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dlq.movedAt ? format(new Date(dlq.movedAt), 'MMM d, HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRequeue(dlq.id)}
                          disabled={requeue.isPending && requeue.variables?.dlqId === dlq.id}
                        >
                          <RefreshCw className={`mr-2 h-3 w-3 ${(requeue.isPending && requeue.variables?.dlqId === dlq.id) ? 'animate-spin' : ''}`} />
                          Requeue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {dlqPage && dlqPage.total > limit && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, dlqPage.total)} of {dlqPage.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * limit >= dlqPage.total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
