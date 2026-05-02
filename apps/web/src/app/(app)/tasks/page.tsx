'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LayoutGrid, List, ListChecks, Plus, Search } from 'lucide-react';
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
  EmptyState,
  ErrorBanner,
  FieldError,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  TagsInput,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui';
import { KanbanBoard } from '@/components/kanban-board';
import { get, getApiErrorMessage, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ISSUE_TYPES, getIssueType, issueTypeFromTags, tagsFromIssueType, userTags, type IssueType } from '@/lib/issue-types';

type Task = {
  id: string;
  key: string;
  title: string;
  priority?: string;
  dueDate?: string | null;
  status?: { name: string };
  assignee?: { id: string; name?: string; email?: string };
  tags?: unknown;
};

type Project = { id: string; name: string; code: string };
type TaskStatus = { id: string; name: string; projectId: string; isDefault?: boolean };

export default function TasksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>('all');
  const [open, setOpen] = useState(false);
  const [boardProjectId, setBoardProjectId] = useState<string>('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: () => get<{ items: Task[]; total: number }>('/tasks', { limit: 100 }),
  });
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 100 }) });
  const projectItems = projects.data?.items ?? [];
  const activeBoardProjectId = boardProjectId || projectItems[0]?.id || '';

  // Press "C" anywhere (when not typing in a field) to open Create Task.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = (data?.items ?? []).filter((t) => {
    if (search && !`${t.key} ${t.title}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'overdue') {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).getTime() < Date.now();
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Tasks"
        description={data ? `${data.total ?? data.items.length} tasks across all projects` : 'Loading…'}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="pl-8" />
          </div>
          <div className="inline-flex bg-[color:var(--color-surface-2)] rounded-md p-0.5 h-8">
            {[
              { v: 'all', l: 'All' },
              { v: 'mine', l: 'Mine' },
              { v: 'overdue', l: 'Overdue' },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setFilter(t.v as typeof filter)}
                className={cn(
                  'h-7 px-3 rounded-md text-xs font-medium transition-colors',
                  filter === t.v
                    ? 'bg-[color:var(--color-surface)] text-[color:var(--color-fg)] shadow-xs'
                    : 'text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]',
                )}
              >
                {t.l}
              </button>
            ))}
          </div>
          <div className="ml-auto inline-flex bg-[color:var(--color-surface-2)] rounded-md p-0.5 h-8">
            <button
              onClick={() => setView('list')}
              className={cn('h-7 w-8 rounded-md inline-flex items-center justify-center transition-colors', view === 'list' ? 'bg-[color:var(--color-surface)] shadow-xs' : 'text-[color:var(--color-fg-muted)]')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('board')}
              className={cn('h-7 w-8 rounded-md inline-flex items-center justify-center transition-colors', view === 'board' ? 'bg-[color:var(--color-surface)] shadow-xs' : 'text-[color:var(--color-fg-muted)]')}
              aria-label="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === 'board' && projectItems.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <Label htmlFor="boardProject">Project</Label>
            <div className="w-72">
              <Select
                id="boardProject"
                value={activeBoardProjectId}
                onChange={(e) => setBoardProjectId(e.target.value)}
              >
                {projectItems.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </Select>
            </div>
            <span className="text-xs text-[color:var(--color-fg-muted)]">Drag cards between columns to change status</span>
          </div>
        )}

        {error && <ErrorBanner error={error} onRetry={refetch} className="mb-3" />}

        {view === 'list' ? (
          isLoading ? (
            <Card><CardBody className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></CardBody></Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks here"
              description={search ? 'Try a different search.' : 'Create your first task to start tracking work.'}
              action={!search && projectItems.length > 0 ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New task</Button> : undefined}
            />
          ) : (
            <TaskTable items={items} />
          )
        ) : projectItems.length === 0 ? (
          <EmptyState icon={ListChecks} title="No projects yet" description="Create a project to use the kanban board." />
        ) : (
          <KanbanBoard projectId={activeBoardProjectId} />
        )}
      </div>

      <NewTaskDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects.data?.items ?? []}
        onCreated={(task) => {
          // Optimistically prepend to the list cache so the user sees the new task immediately.
          qc.setQueryData<{ items: Task[]; total: number } | undefined>(['tasks', 'list'], (old) => {
            if (!old) return old;
            const exists = old.items.some((t) => t.id === task.id);
            if (exists) return old;
            return { ...old, items: [task, ...old.items], total: (old.total ?? old.items.length) + 1 };
          });
          qc.invalidateQueries({ queryKey: ['tasks'] });
          // If the user was on board view, jump to the task's project so they see it.
          if (view === 'board' && task.projectId) setBoardProjectId(task.projectId);
          // Clear filters/search so the new task is definitely visible.
          setSearch('');
          setFilter('all');
          setOpen(false);
          toast.success(`Task ${task.key ?? ''} created`, {
            action: { label: 'Open', onClick: () => (window.location.href = `/tasks/${task.id}`) },
          });
        }}
      />
    </>
  );
}

const taskSchema = z.object({
  projectId: z.string().min(1, 'Pick a project'),
  statusId: z.string().min(1, 'Pick a status'),
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueDate: z.string().optional(),
  estimateHours: z.string().optional(),
});
type TaskForm = z.infer<typeof taskSchema>;
type CreatedTask = Task & { projectId: string };

type AssigneeOpt = { id: string; name?: string; fullName?: string; email?: string };
type TaskOpt = { id: string; key: string; title: string };

function NewTaskDialog({ open, onOpenChange, projects, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; projects: Project[]; onCreated: (task: CreatedTask) => void }) {
  const { register, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'MEDIUM' },
  });
  const [issueType, setIssueType] = useState<IssueType>('TASK');
  const [tags, setTags] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [parentTaskId, setParentTaskId] = useState<string>('');

  const projectId = watch('projectId');
  const statuses = useQuery({
    queryKey: ['task-statuses', projectId],
    queryFn: () => get<{ items: TaskStatus[] } | TaskStatus[]>('/task-statuses', { projectId }),
    enabled: !!projectId,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: AssigneeOpt[] }>('/users', { limit: 100 }) });
  const projectTasks = useQuery({
    queryKey: ['tasks', 'for-parent', projectId],
    queryFn: () => get<{ items: TaskOpt[] }>('/tasks', { projectId, limit: 100 }),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: (v: TaskForm) =>
      post<Task & { projectId: string }>('/tasks', {
        projectId: v.projectId,
        statusId: v.statusId,
        title: v.title,
        description: v.description || undefined,
        priority: v.priority,
        dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : undefined,
        estimateHours: v.estimateHours ? Number(v.estimateHours) : undefined,
        assigneeId: assigneeId || undefined,
        parentTaskId: parentTaskId || undefined,
        // Encode issue type as a "type:" tag so we can show the right icon.
        tags: tagsFromIssueType(parentTaskId ? 'SUBTASK' : issueType, tags),
      }),
    onSuccess: (task) => {
      reset();
      setTags([]); setAssigneeId(''); setParentTaskId(''); setIssueType('TASK');
      onCreated(task);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const statusItems = Array.isArray(statuses.data) ? statuses.data : statuses.data?.items ?? [];
  const userItems = users.data?.items ?? [];
  const taskItems = projectTasks.data?.items ?? [];
  const effectiveType = parentTaskId ? 'SUBTASK' : issueType;
  const TypeIcon = getIssueType(effectiveType).icon;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Create task" description="Press C anywhere to open this dialog" />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            {/* Issue type pills */}
            <div>
              <Label>Issue type</Label>
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_TYPES.filter((t) => t.id !== 'SUBTASK').map((t) => {
                  const Icon = t.icon;
                  const active = effectiveType === t.id;
                  const disabled = !!parentTaskId;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => !disabled && setIssueType(t.id)}
                      disabled={disabled}
                      className={cn(
                        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-all',
                        active
                          ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-soft)]'
                          : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
                        disabled && 'opacity-50',
                      )}
                      title={disabled ? 'Sub-task type is auto-set when a parent is picked' : t.label}
                    >
                      <span
                        className="h-4 w-4 rounded inline-flex items-center justify-center"
                        style={{ background: t.bg, color: t.color }}
                      >
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      {t.label}
                    </button>
                  );
                })}
                {parentTaskId && (
                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                    <span
                      className="h-4 w-4 rounded inline-flex items-center justify-center"
                      style={{ background: getIssueType('SUBTASK').bg, color: getIssueType('SUBTASK').color }}
                    >
                      <TypeIcon className="h-2.5 w-2.5" />
                    </span>
                    Sub-task
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="projectId" required>Project</Label>
                <Select id="projectId" {...register('projectId')} onChange={(e) => { setValue('projectId', e.target.value); setValue('statusId', ''); setParentTaskId(''); }}>
                  <option value="">Select project…</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
                </Select>
                <FieldError>{errors.projectId?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="statusId" required>Status</Label>
                <Select id="statusId" {...register('statusId')} disabled={!projectId}>
                  <option value="">{projectId ? 'Select status…' : 'Pick a project first'}</option>
                  {statusItems.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (default)' : ''}</option>))}
                </Select>
                <FieldError>{errors.statusId?.message}</FieldError>
              </div>
            </div>

            <div>
              <Label htmlFor="title" required>Summary</Label>
              <Input id="title" {...register('title')} placeholder="What needs to be done?" autoFocus />
              <FieldError>{errors.title?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="Add detail. Press Cmd/Ctrl+Enter to submit." onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget.form?.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.click();
                }
              }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="assignee">Assignee</Label>
                <Select id="assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {userItems.map((u) => (<option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>))}
                </Select>
              </div>
              <div>
                <Label htmlFor="parent">Parent task (sub-task)</Label>
                <Select id="parent" value={parentTaskId} onChange={(e) => setParentTaskId(e.target.value)} disabled={!projectId}>
                  <option value="">{projectId ? 'None' : 'Pick a project first'}</option>
                  {taskItems.map((t) => (<option key={t.id} value={t.id}>{t.key} · {t.title}</option>))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" {...register('priority')}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" type="date" {...register('dueDate')} />
              </div>
              <div>
                <Label htmlFor="estimateHours">Estimate (h)</Label>
                <Input id="estimateHours" type="number" step="0.25" min="0" {...register('estimateHours')} placeholder="0" />
              </div>
            </div>

            <div>
              <Label>Tags / labels</Label>
              <TagsInput value={tags} onChange={setTags} placeholder="Add label and press Enter (e.g. backend, blocker)" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function TaskTable({ items }: { items: Task[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Type</TH>
          <TH>Task</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
          <TH>Tags</TH>
          <TH>Assignee</TH>
          <TH>Due date</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((t) => {
          const type = getIssueType(issueTypeFromTags(t.tags));
          const TypeIcon = type.icon;
          const tags = userTags(t.tags);
          return (
          <TR key={t.id} onClick={() => (window.location.href = `/tasks/${t.id}`)}>
            <TD>
              <span
                className="h-5 w-5 rounded inline-flex items-center justify-center"
                style={{ background: type.bg, color: type.color }}
                title={type.label}
              >
                <TypeIcon className="h-3 w-3" />
              </span>
            </TD>
            <TD>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[color:var(--color-fg-muted)] flex-shrink-0">{t.key}</span>
                <span className="font-medium truncate">{t.title}</span>
              </div>
            </TD>
            <TD>{t.status?.name ? <Badge tone="primary">{t.status.name}</Badge> : <span className="text-[color:var(--color-fg-subtle)]">—</span>}</TD>
            <TD>{t.priority ? <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge> : <span className="text-[color:var(--color-fg-subtle)]">—</span>}</TD>
            <TD>
              {tags.length === 0 ? (
                <span className="text-[color:var(--color-fg-subtle)] text-xs">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="neutral" size="sm">{tag}</Badge>
                  ))}
                  {tags.length > 3 && <Badge tone="neutral" size="sm">+{tags.length - 3}</Badge>}
                </div>
              )}
            </TD>
            <TD>
              {t.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar size="xs" name={t.assignee.name ?? t.assignee.email} />
                  <span className="text-sm">{t.assignee.name ?? t.assignee.email}</span>
                </div>
              ) : (
                <span className="text-[color:var(--color-fg-subtle)]">Unassigned</span>
              )}
            </TD>
            <TD className="text-sm text-[color:var(--color-fg-muted)]">
              {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
            </TD>
          </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function priorityTone(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'CRITICAL') return 'danger';
  if (p === 'HIGH') return 'warning';
  if (p === 'LOW') return 'info';
  return 'neutral';
}
