'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Clock, MoreHorizontal, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  DropdownContent, DropdownItem, DropdownRoot, DropdownTrigger,
  EmptyState, FieldError, Input, Label, PageHeader, Select, Skeleton,
  TBody, TD, TH, THead, TR, Table, Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Entry = { id: string; entryDate?: string; date?: string; hours?: number; note?: string; description?: string; project?: { name?: string }; task?: { title?: string; key?: string }; status?: string; source?: string };
type Project = { id: string; name: string; code: string };
type Task = { id: string; key: string; title: string };

const schema = z.object({
  projectId: z.string().min(1, 'Project required'),
  taskId: z.string().optional(),
  entryDate: z.string().min(1, 'Date required'),
  hours: z.string().min(1, 'Hours required'),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function TimePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['time-entries'], queryFn: () => get<{ items?: Entry[] } | Entry[]>('/time-entries') });
  const summary = useQuery({ queryKey: ['time-entries', 'summary'], queryFn: () => get<{ totalHours?: number; billableHours?: number; days?: number }>('/time-entries/summary') });
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 100 }) });

  const items = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <>
      <PageHeader title="Time entries" description="Log and track your time" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log time</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Total hours</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums">{summary.data?.totalHours ?? '—'}</p>
          </CardBody></Card>
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Billable</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums">{summary.data?.billableHours ?? '—'}</p>
          </CardBody></Card>
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Days logged</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums">{summary.data?.days ?? '—'}</p>
          </CardBody></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
          <CardBody className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : items.length === 0 ? (
              <EmptyState icon={Clock} title="No time entries yet" description="Log your work to track productivity and bill projects." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Log time</Button>} />
            ) : (
              <Table>
                <THead><TR><TH>Date</TH><TH>Project</TH><TH>Task</TH><TH>Note</TH><TH>Hours</TH><TH>Source</TH><TH align="right">Actions</TH></TR></THead>
                <TBody>
                  {items.map((e) => (
                    <TR key={e.id}>
                      <TD>{e.entryDate ? new Date(e.entryDate).toLocaleDateString() : e.date ? new Date(e.date).toLocaleDateString() : '—'}</TD>
                      <TD className="text-sm">{e.project?.name ?? '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{e.task ? `${e.task.key ?? ''} ${e.task.title ?? ''}` : '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)] max-w-xs truncate">{e.note ?? e.description ?? '—'}</TD>
                      <TD className="tabular-nums font-medium">{e.hours ?? '—'}</TD>
                      <TD>
                        <div className="flex items-center gap-1.5">
                          {e.source && <Badge tone="neutral" size="sm">{e.source}</Badge>}
                          {e.status === 'LOCKED' && <Badge tone="warning" size="sm">LOCKED</Badge>}
                        </div>
                      </TD>
                      <TD align="right">
                        <EntryActions entry={e} onChanged={() => qc.invalidateQueries({ queryKey: ['time-entries'] })} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <LogDialog open={open} onOpenChange={setOpen} projects={projects.data?.items ?? []} onCreated={() => { qc.invalidateQueries({ queryKey: ['time-entries'] }); setOpen(false); }} />
    </>
  );
}

function LogDialog({ open, onOpenChange, projects, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; projects: Project[]; onCreated: () => void }) {
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const projectId = watch('projectId');
  const tasks = useQuery({
    queryKey: ['tasks-for-project', projectId],
    queryFn: () => get<{ items: Task[] }>('/tasks', { projectId, limit: 100 }),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: (v: FormValues) => post('/time-entries', {
      projectId: v.projectId,
      taskId: v.taskId || undefined,
      entryDate: new Date(v.entryDate).toISOString(),
      hours: Number(v.hours),
      source: 'MANUAL',
      note: v.note || undefined,
    }),
    onSuccess: () => { toast.success('Time logged'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Log time" />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="projectId" required>Project</Label>
              <Select id="projectId" {...register('projectId')}>
                <option value="">Select project…</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
              </Select>
              <FieldError>{errors.projectId?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="taskId">Task (optional)</Label>
              <Select id="taskId" {...register('taskId')} disabled={!projectId}>
                <option value="">{projectId ? 'No specific task' : 'Pick a project first'}</option>
                {(tasks.data?.items ?? []).map((t) => (<option key={t.id} value={t.id}>{t.key} · {t.title}</option>))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="entryDate" required>Date</Label><Input id="entryDate" type="date" {...register('entryDate')} /><FieldError>{errors.entryDate?.message}</FieldError></div>
              <div><Label htmlFor="hours" required>Hours</Label><Input id="hours" type="number" step="0.25" min="0.25" max="24" {...register('hours')} placeholder="2.5" /><FieldError>{errors.hours?.message}</FieldError></div>
            </div>
            <div>
              <Label htmlFor="note">What did you work on?</Label>
              <Textarea id="note" {...register('note')} placeholder="Optional note…" />
            </div>
            <p className="text-xs text-[color:var(--color-fg-muted)]">💡 Tip: send <span className="font-mono bg-[color:var(--color-surface-2)] px-1 rounded">log 2h T-101</span> on WhatsApp.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Log time</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function EntryActions({ entry, onChanged }: { entry: Entry; onChanged: () => void }) {
  const [adjustOpen, setAdjustOpen] = useState(false);

  const unlock = useMutation({
    mutationFn: () => post(`/time-entries/${entry.id}/unlock`),
    onSuccess: () => { toast.success('Entry unlocked'); onChanged(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <DropdownRoot>
        <DropdownTrigger asChild>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)]"
            aria-label="Entry actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => setAdjustOpen(true)}>Adjust hours…</DropdownItem>
          {entry.status === 'LOCKED' && (
            <DropdownItem onSelect={() => unlock.mutate()}>Unlock entry</DropdownItem>
          )}
        </DropdownContent>
      </DropdownRoot>
      {adjustOpen && (
        <AdjustEntryDialog entry={entry} onClose={() => setAdjustOpen(false)} onAdjusted={() => { onChanged(); setAdjustOpen(false); }} />
      )}
    </>
  );
}

function AdjustEntryDialog({ entry, onClose, onAdjusted }: { entry: Entry; onClose: () => void; onAdjusted: () => void }) {
  const [delta, setDelta] = useState('-0.25');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const adjust = useMutation({
    mutationFn: () => post(`/time-entries/${entry.id}/adjust`, {
      hoursDelta: Number(delta),
      reason,
      note: note || undefined,
    }),
    onSuccess: () => { toast.success('Hours adjusted'); onAdjusted(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader title="Adjust hours" description="Use a positive value to add hours, negative to remove. Increments of 0.25." />
        <form onSubmit={(e) => { e.preventDefault(); if (delta && reason.trim()) adjust.mutate(); }}>
          <DialogBody className="space-y-4">
            <div className="bg-[color:var(--color-surface-2)] rounded-lg p-3 text-xs">
              <p>Current: <span className="font-medium tabular-nums">{entry.hours ?? '—'}h</span> on {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : '—'}</p>
              {entry.note && <p className="text-[color:var(--color-fg-muted)] mt-1">{entry.note}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="delta" required>Hours change (±)</Label>
                <Input id="delta" type="number" step="0.25" value={delta} onChange={(e) => setDelta(e.target.value)} />
                <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">New total: <span className="tabular-nums font-medium">{((Number(entry.hours ?? 0) + Number(delta || 0)) || 0).toFixed(2)}h</span></p>
              </div>
              <div>
                <Label htmlFor="reason" required>Reason</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Over-logged" />
              </div>
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context for the audit log" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={adjust.isPending} disabled={!delta || !reason.trim()}>Apply adjustment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
