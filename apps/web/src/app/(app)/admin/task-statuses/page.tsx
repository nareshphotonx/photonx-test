'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Workflow } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Select, Skeleton,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Project = { id: string; name: string; code: string };
type Status = { id: string; name: string; code: string; color?: string; position?: number; isDone?: boolean; isDefault?: boolean };

const schema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).regex(/^[A-Z0-9_]+$/i, 'Letters, numbers, _'),
  color: z.string().optional(),
  isDone: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function TaskStatusesPage() {
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 100 }) });
  const [projectId, setProjectId] = useState<string>('');

  const projectItems = projects.data?.items ?? [];
  const selected = projectId || projectItems[0]?.id;

  return (
    <>
      <PageHeader title="Task statuses" description="Define your task workflow per project." />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="project">Project</Label>
          <div className="w-64">
            <Select id="project" value={selected ?? ''} onChange={(e) => setProjectId(e.target.value)}>
              {projectItems.length === 0 && <option value="">No projects yet</option>}
              {projectItems.map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
            </Select>
          </div>
        </div>
        {selected ? <StatusList projectId={selected} /> : <EmptyState icon={Workflow} title="Create a project first" description="Statuses are configured per project." />}
      </div>
    </>
  );
}

function StatusList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['task-statuses', projectId], queryFn: () => get<{ items?: Status[] } | Status[]>('/task-statuses', { projectId }) });
  const items = (Array.isArray(data) ? data : data?.items ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/task-statuses', { projectId, ...v, position: items.length }),
    onSuccess: () => { toast.success('Status added'); reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['task-statuses', projectId] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Statuses</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add status</Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {isLoading ? <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          : items.length === 0 ? <EmptyState icon={Workflow} title="No statuses defined" description="Add statuses like To do, In progress, Done." />
          : (
            <Table>
              <THead><TR><TH>Order</TH><TH>Name</TH><TH>Code</TH><TH>Flags</TH><TH>Color</TH></TR></THead>
              <TBody>
                {items.map((s, i) => (
                  <TR key={s.id}>
                    <TD className="text-[color:var(--color-fg-muted)]">{s.position ?? i + 1}</TD>
                    <TD className="font-medium">{s.name}</TD>
                    <TD className="font-mono text-xs">{s.code}</TD>
                    <TD className="space-x-1">
                      {s.isDefault && <Badge tone="primary" size="sm">Default</Badge>}
                      {s.isDone && <Badge tone="success" size="sm">Done state</Badge>}
                    </TD>
                    <TD>{s.color && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full inline-block" style={{ background: s.color }} /><span className="text-xs font-mono">{s.color}</span></span>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
      </CardBody>

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="Add task status" />
          <form onSubmit={handleSubmit((v) => create.mutate(v))}>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="name" required>Name</Label><Input id="name" {...register('name')} placeholder="In progress" /><FieldError>{errors.name?.message}</FieldError></div>
                <div><Label htmlFor="code" required>Code</Label><Input id="code" {...register('code')} className="font-mono uppercase" placeholder="IN_PROGRESS" /><FieldError>{errors.code?.message}</FieldError></div>
              </div>
              <div><Label htmlFor="color">Color (hex)</Label><Input id="color" {...register('color')} className="font-mono" placeholder="#0d9488" /></div>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" {...register('isDefault')} className="h-4 w-4 accent-[color:var(--color-primary)]" /> Default starting status</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register('isDone')} className="h-4 w-4 accent-[color:var(--color-primary)]" /> Mark task as done when in this status</label>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </Card>
  );
}
