import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';
import { useListOrgs, useCreateOrg, getListOrgsQueryKey } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function Orgs() {
  const { data: orgs, isLoading } = useListOrgs();
  const createOrg = useCreateOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createOrg.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrgsQueryKey() });
          setOpen(false);
          setName('');
          toast({ title: "Organization created successfully" });
        },
        onError: (err: any) => {
          toast({ 
            variant: "destructive", 
            title: "Failed to create organization",
            description: err.message 
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground mt-1">Select an organization to manage its distributed infrastructure.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>
                  Create a new isolation boundary for projects and queues.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Acme Corp" 
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createOrg.isPending || !name.trim()}>
                  {createOrg.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : orgs?.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No organizations found</h3>
            <p className="text-muted-foreground mb-4 mt-1 max-w-sm">
              You aren't a member of any organizations yet. Create one to get started.
            </p>
            <Button onClick={() => setOpen(true)}>Create Organization</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs?.map((org) => (
            <Link key={org.id} href={`/projects?orgId=${org.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-md bg-secondary/50 flex items-center justify-center text-secondary-foreground mb-3">
                      <Building2 size={20} />
                    </div>
                    <ArrowRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-200" size={18} />
                  </div>
                  <CardTitle className="text-xl">{org.name}</CardTitle>
                  <CardDescription className="flex justify-between items-center">
                    <span className="font-mono text-xs opacity-70">ID: {org.id.split('-')[0]}</span>
                    {org.createdAt && (
                      <span className="text-xs">
                        Created {formatDistanceToNow(new Date(org.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
