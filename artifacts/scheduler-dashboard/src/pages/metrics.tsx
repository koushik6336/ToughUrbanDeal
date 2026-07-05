import { useState } from 'react';
import { useGetMetricsSummary, useGetThroughputMetrics, getGetMetricsSummaryQueryKey, getGetThroughputMetricsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Activity, CheckCircle2, Clock, XCircle, Ghost, ServerCog } from 'lucide-react';
import { format } from 'date-fns';

export default function Metrics() {
  const [range, setRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  
  const { data: summary, isLoading: isLoadingSummary } = useGetMetricsSummary({ query: { queryKey: getGetMetricsSummaryQueryKey(), refetchInterval: 5000 } });
  const { data: throughput, isLoading: isLoadingThroughput } = useGetThroughputMetrics({ range }, { query: { queryKey: getGetThroughputMetricsQueryKey({ range }), refetchInterval: 5000 } });

  const chartData = throughput?.data.map(d => ({
    ...d,
    formattedTime: format(new Date(d.time), range === '1h' ? 'HH:mm' : range === '7d' ? 'MMM d' : 'HH:mm')
  })) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Metrics</h1>
          <p className="text-muted-foreground mt-1">Real-time global throughput and cluster health.</p>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active Workers</p>
              <ServerCog className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline space-x-2">
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <h2 className="text-3xl font-bold font-mono">{summary?.activeWorkers ?? 0}</h2>
                  <span className="text-xs text-muted-foreground font-mono">nodes online</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">System Queued</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline space-x-2">
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <h2 className="text-3xl font-bold font-mono">{summary?.queued ?? 0}</h2>
                  <span className="text-xs text-muted-foreground font-mono">pending tasks</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Success Rate</p>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <h2 className="text-3xl font-bold font-mono text-emerald-500">{((summary?.successRate ?? 0) * 100).toFixed(1)}%</h2>
                  <span className="text-xs text-emerald-500/70 font-mono">trailing 24h</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-destructive/80">Dead Letters</p>
              <Ghost className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex items-baseline space-x-2">
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <h2 className="text-3xl font-bold font-mono text-destructive">{summary?.deadLetter ?? 0}</h2>
                  <span className="text-xs text-destructive/70 font-mono">unrecoverable</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded"><CheckCircle2 size={18} /></div>
            <span className="text-sm font-medium text-emerald-500">Completed All Time</span>
          </div>
          {isLoadingSummary ? <Skeleton className="h-6 w-20" /> : <span className="font-mono font-bold text-lg">{summary?.completed ?? 0}</span>}
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded animate-pulse"><Activity size={18} /></div>
            <span className="text-sm font-medium text-amber-500">Currently Running</span>
          </div>
          {isLoadingSummary ? <Skeleton className="h-6 w-20" /> : <span className="font-mono font-bold text-lg">{summary?.running ?? 0}</span>}
        </div>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/20 text-destructive rounded"><XCircle size={18} /></div>
            <span className="text-sm font-medium text-destructive">Failed Attempts</span>
          </div>
          {isLoadingSummary ? <Skeleton className="h-6 w-20" /> : <span className="font-mono font-bold text-lg">{summary?.failed ?? 0}</span>}
        </div>
      </div>

      {/* Throughput Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Throughput</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Jobs completed vs failed over time.</p>
          </div>
          <Select value={range} onValueChange={(v: any) => setRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoadingThroughput ? (
            <div className="h-[350px] w-full flex items-center justify-center">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
              No throughput data for this period
            </div>
          ) : (
            <div className="h-[350px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="formattedTime" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                      fontSize: '12px',
                      fontFamily: 'var(--app-font-mono)'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line 
                    type="monotone" 
                    name="Completed"
                    dataKey="completed" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }}
                  />
                  <Line 
                    type="monotone" 
                    name="Failed"
                    dataKey="failed" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#ef4444', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
