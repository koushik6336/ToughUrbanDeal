import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { useEffect } from 'react';

// Pages
import Login from '@/pages/login';
import Signup from '@/pages/signup';
import Orgs from '@/pages/orgs';
import Projects from '@/pages/projects';
import Queues from '@/pages/queues';
import QueueDetail from '@/pages/queue-detail';
import JobDetail from '@/pages/job-detail';
import Workers from '@/pages/workers';
import DLQ from '@/pages/dlq';
import Metrics from '@/pages/metrics';
import Layout from '@/components/layout';

// Setup auth token getter for API client
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params) => {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          window.location.href = "/login";
          return null;
        }
        return (
          <Layout>
            <Component params={params} />
          </Layout>
        );
      }}
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
      <Route path="/">
        {() => {
          const [, setLocation] = useLocation();
          useEffect(() => {
            setLocation("/metrics");
          }, []);
          return null;
        }}
      </Route>

      <ProtectedRoute path="/orgs" component={Orgs} />
      <ProtectedRoute path="/projects" component={Projects} />
      <ProtectedRoute path="/queues" component={Queues} />
      <ProtectedRoute path="/queues/:queueId" component={QueueDetail} />
      <ProtectedRoute path="/jobs/:jobId" component={JobDetail} />
      <ProtectedRoute path="/workers" component={Workers} />
      <ProtectedRoute path="/dlq" component={DLQ} />
      <ProtectedRoute path="/metrics" component={Metrics} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
