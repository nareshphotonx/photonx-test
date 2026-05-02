'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FolderKanban, MoreHorizontal, Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownTrigger,
  EmptyState,
  FieldError,
  Input,
  Label,
  PageHeader,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  ownerId?: string;
  owner?: { id: string; name?: string; email?: string };
  createdAt?: string;
};

const schema = z.object({
  name: z.string().min(2, 'Min 2 characters'),
  code: z.string().min(1, 'Required').max(10).regex(/^[A-Z0-9_-]+$/i, 'Letters, numbers, _ or -'),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => get<{ items: Project[]; total: number }>('/projects', { limit: 100 }),
  });

  const items = (data?.items ?? []).filter((p) =>
    `${p.code} ${p.name}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Projects"
        description={data ? `${data.total ?? items.length} project${(data.total ?? items.length) === 1 ? '' : 's'}` : 'Manage your work'}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects" className="pl-8" />
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardBody className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </CardBody>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={search ? 'No projects match your search' : 'No projects yet'}
            description={search ? undefined : 'Create a project to start tracking work and tasks.'}
            action={!search && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create project</Button>}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Code</TH>
                <TH>Status</TH>
                <TH>Owner</TH>
                <TH>Start date</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 group">
                      <div className="h-9 w-9 rounded-lg bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {p.code?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[color:var(--color-fg)] group-hover:text-[color:var(--color-primary)] transition-colors truncate">
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="text-xs text-[color:var(--color-fg-muted)] truncate max-w-[20rem]">{p.description}</p>
                        )}
                      </div>
                    </Link>
                  </TD>
                  <TD><span className="font-mono text-xs">{p.code}</span></TD>
                  <TD><Badge tone={statusTone(p.status)}>{p.status ?? 'ACTIVE'}</Badge></TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar size="xs" name={p.owner?.name ?? p.owner?.email} />
                      <span className="text-sm">{p.owner?.name ?? p.owner?.email ?? '—'}</span>
                    </div>
                  </TD>
                  <TD className="text-[color:var(--color-fg-muted)] text-sm">{p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}</TD>
                  <TD align="right">
                    <DropdownRoot>
                      <DropdownTrigger asChild>
                        <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)]">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem onSelect={() => (window.location.href = `/projects/${p.id}`)}>Open</DropdownItem>
                        <DropdownItem onSelect={() => (window.location.href = `/tasks?projectId=${p.id}`)}>View tasks</DropdownItem>
                      </DropdownContent>
                    </DropdownRoot>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <NewProjectDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['projects'] });
          setOpen(false);
        }}
      />
    </>
  );
}

function NewProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (v: FormValues) => post('/projects', v),
    onSuccess: () => {
      toast.success('Project created');
      reset();
      onCreated();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Create project" description="Give your project a name and a short code (e.g. WEB)." />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="name" required>Name</Label>
              <Input id="name" {...register('name')} placeholder="Website redesign" />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="code" required>Code</Label>
              <Input id="code" {...register('code')} placeholder="WEB" autoCapitalize="characters" />
              <FieldError>{errors.code?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="What's this project about?" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function statusTone(s?: string): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (!s) return 'primary';
  if (s === 'ACTIVE' || s === 'IN_PROGRESS') return 'primary';
  if (s === 'COMPLETED') return 'success';
  if (s === 'ON_HOLD') return 'warning';
  if (s === 'CANCELLED' || s === 'ARCHIVED') return 'danger';
  return 'neutral';
}
