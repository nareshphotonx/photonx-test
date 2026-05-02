'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Target, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, Input, Label, PageHeader, Select, Skeleton, Textarea,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { del, get, getApiErrorMessage, patch, post } from '@/lib/api';

type Project = { id: string; name: string; code: string };
type Milestone = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  dueDate?: string;
  endDate?: string;
};

export default function MilestonesPage() {
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 100 }) });
  const projectItems = projects.data?.items ?? [];
  const [projectId, setProjectId] = useState<string>('');
  const selectedProjectId = projectId || projectItems[0]?.id || '';

  return (
    <>
      <PageHeader title="Milestones" description="Group tasks into delivery milestones, per project" />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="project">Project</Label>
          <div className="w-72">
            <Select id="project" value={selectedProjectId} onChange={(e) => setProjectId(e.target.value)}>
              {projectItems.length === 0 && <option value="">No projects yet</option>}
              {projectItems.map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
            </Select>
          </div>
        </div>
        {selectedProjectId ? (
          <MilestoneList projectId={selectedProjectId} />
        ) : (
          <EmptyState icon={Target} title="Create a project first" description="Milestones live inside a project." />
        )}
      </div>
    </>
  );
}

function MilestoneList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);

  const list = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await get<{ items?: Milestone[] } | Milestone[]>(`/projects/${projectId}/milestones`);
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/milestones/${id}`),
    onSuccess: () => { toast.success('Milestone deleted'); qc.invalidateQueries({ queryKey: ['milestones', projectId] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const items = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Milestones</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> New milestone</Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Target} title="No milestones yet" description="Group related tasks under a milestone to track delivery." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New milestone</Button>} />
        ) : (
          <Table>
            <THead><TR><TH>Name</TH><TH>Status</TH><TH>Start</TH><TH>Due</TH><TH align="right">Actions</TH></TR></THead>
            <TBody>
              {items.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <p className="font-medium">{m.name}</p>
                    {m.description && <p className="text-xs text-[color:var(--color-fg-muted)] mt-0.5 max-w-md truncate">{m.description}</p>}
                  </TD>
                  <TD><Badge tone={statusTone(m.status)}>{m.status ?? 'PLANNED'}</Badge></TD>
                  <TD className="text-sm text-[color:var(--color-fg-muted)]">{m.startDate ? new Date(m.startDate).toLocaleDateString() : '—'}</TD>
                  <TD className="text-sm text-[color:var(--color-fg-muted)]">{m.dueDate ?? m.endDate ? new Date((m.dueDate ?? m.endDate)!).toLocaleDateString() : '—'}</TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete milestone "${m.name}"?`)) remove.mutate(m.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>

      {open && (
        <MilestoneDialog
          projectId={projectId}
          onClose={() => setOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['milestones', projectId] }); setOpen(false); }}
        />
      )}
      {editing && (
        <MilestoneDialog
          projectId={projectId}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['milestones', projectId] }); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function MilestoneDialog({ projectId, existing, onClose, onSaved }: { projectId: string; existing?: Milestone; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [status, setStatus] = useState<Milestone['status']>(existing?.status ?? 'PLANNED');
  const [startDate, setStartDate] = useState(existing?.startDate?.slice(0, 10) ?? '');
  const [dueDate, setDueDate] = useState((existing?.dueDate ?? existing?.endDate)?.slice(0, 10) ?? '');

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description: description || undefined,
        status,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      return existing ? patch(`/milestones/${existing.id}`, body) : post('/milestones', { ...body, projectId });
    },
    onSuccess: () => { toast.success(existing ? 'Milestone updated' : 'Milestone created'); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader title={existing ? 'Edit milestone' : 'New milestone'} />
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="m-name" required>Name</Label>
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Beta release" autoFocus />
            </div>
            <div>
              <Label htmlFor="m-desc">Description</Label>
              <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this milestone cover?" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="m-status">Status</Label>
                <Select id="m-status" value={status} onChange={(e) => setStatus(e.target.value as Milestone['status'])}>
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="m-start">Start date</Label>
                <Input id="m-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="m-due">Due date</Label>
                <Input id="m-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending} disabled={!name.trim()}>{existing ? 'Save' : 'Create milestone'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function statusTone(s?: Milestone['status']): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'IN_PROGRESS') return 'primary';
  if (s === 'COMPLETED') return 'success';
  if (s === 'CANCELLED') return 'danger';
  return 'neutral';
}
