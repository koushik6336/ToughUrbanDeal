import { formatDistanceToNow } from 'date-fns';
import { Link, useSearch } from 'wouter';
import { useListProjects, useCreateProject, getListProjectsQueryKey } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderGit2, Plus, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { customFetch } from '@workspace/api-client-react';

export default function Projects() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = params.get('orgId') || '';

  const { data: projects, isLoading } = useListProjects({ orgId }, { query: { queryKey: getListProjectsQueryKey({ orgId }), enabled: !!orgId } });
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !orgId) return;

    createProject.mutate(
      { data: { orgId, name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ orgId }) });
          setOpen(false);
          setName('');
          toast({ title: "Project created successfully" });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Failed to create project",
            description: err.message
          });
        }
      }
    );
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await customFetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ orgId }) });
      toast({ title: `Project "${deleteTarget.name}" deleted` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-bold mb-2">Organization ID missing</h2>
        <p className="text-muted-foreground mb-4">Please select an organization first.</p>
        <Link href="/orgs">
          <Button><ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/orgs" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Manage service boundaries and logical groupings of queues.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Create a new project to house your job queues.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Email Service"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createProject.isPending || !name.trim()}>
                  {createProject.isPending ? "Creating..." : "Create Project"}
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
      ) : projects?.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <FolderGit2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground mb-4 mt-1 max-w-sm">
              This organization has no projects. Create your first project to start creating queues.
            </p>
            <Button onClick={() => setOpen(true)}>Create Project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <div key={project.id} className="relative group">
              <Link href={`/queues?projectId=${project.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-md bg-secondary/50 flex items-center justify-center text-secondary-foreground mb-3">
                        <FolderGit2 size={20} />
                      </div>
                      <ArrowRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-200" size={18} />
                    </div>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    <CardDescription className="flex justify-between items-center">
                      <span className="font-mono text-xs opacity-70">ID: {project.id.split('-')[0]}</span>
                      {project.createdAt && (
                        <span className="text-xs">
                          Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              {/* Delete button — shown on hover */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteTarget({ id: project.id, name: project.name });
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              This will permanently delete all queues and jobs under this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
