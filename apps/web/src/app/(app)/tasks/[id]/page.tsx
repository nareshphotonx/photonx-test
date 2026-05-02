'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Clock, GitBranch, Link2, MessageSquare, Plus, Tag, Trash2, User, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorBanner,
  Input,
  Label,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { del, get, getApiErrorMessage, patch, post } from '@/lib/api';

type Task = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string | null;
  taskStatusId?: string;
  status?: { id: string; name: string };
  assignee?: { id: string; name?: string; email?: string } | null;
  assigneeId?: string | null;
  projectId: string;
  estimateHours?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Comment = { id: string; content: string; createdAt: string; author?: { name?: string; email?: string } };
type StatusOpt = { id: string; name: string; isDone?: boolean; requiresLocation?: boolean };
type UserOpt = { id: string; name?: string; fullName?: string; email?: string };

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const task = useQuery({ queryKey: ['task', id], queryFn: () => get<Task>(`/tasks/${id}`) });
  const projectId = task.data?.projectId;

  const statuses = useQuery({
    queryKey: ['task-statuses', projectId],
    queryFn: () => get<{ items?: StatusOpt[] } | StatusOpt[]>('/task-statuses', { projectId }),
    enabled: !!projectId,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: UserOpt[] }>('/users', { limit: 100 }) });
  const comments = useQuery({
    queryKey: ['task', id, 'comments'],
    queryFn: () => get<{ items?: Comment[] } | Comment[]>(`/tasks/${id}/comments`),
  });

  const statusItems = Array.isArray(statuses.data) ? statuses.data : statuses.data?.items ?? [];
  const userItems = users.data?.items ?? [];
  const commentItems = Array.isArray(comments.data) ? comments.data : comments.data?.items ?? [];

  // Inline editable fields
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPriority, setDraftPriority] = useState<Task['priority']>('MEDIUM');
  const [draftDue, setDraftDue] = useState('');
  const [draftEstimate, setDraftEstimate] = useState('');

  const startEdit = () => {
    if (!task.data) return;
    setDraftTitle(task.data.title);
    setDraftDescription(task.data.description ?? '');
    setDraftPriority(task.data.priority ?? 'MEDIUM');
    setDraftDue(task.data.dueDate ? task.data.dueDate.slice(0, 10) : '');
    setDraftEstimate(task.data.estimateHours != null ? String(task.data.estimateHours) : '');
    setEditing(true);
  };

  const updateTask = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch(`/tasks/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
      setEditing(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const changeStatus = useMutation({
    mutationFn: (statusId: string) => post(`/tasks/${id}/status`, { statusId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const reassign = useMutation({
    mutationFn: (assigneeId: string) => patch(`/tasks/${id}`, { assigneeId: assigneeId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      toast.success('Assignee updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => del(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      router.replace('/tasks');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const addComment = useMutation({
    mutationFn: (content: string) => post(`/tasks/${id}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id, 'comments'] });
      toast.success('Comment added');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (task.isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (task.error || !task.data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </Link>
        <ErrorBanner error={task.error ?? new Error('Task not found')} onRetry={task.refetch} />
      </div>
    );
  }

  const t = task.data;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <p className="font-mono text-xs text-[color:var(--color-fg-muted)] mb-1">{t.key}</p>
            {editing ? (
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="text-2xl font-semibold h-12 px-3"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
            )}
          </div>

          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit details</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Add more detail…"
                    className="min-h-32"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select id="priority" value={draftPriority} onChange={(e) => setDraftPriority(e.target.value as Task['priority'])}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due">Due date</Label>
                    <Input id="due" type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="estimate">Estimate (h)</Label>
                    <Input id="estimate" type="number" step="0.25" min="0" value={draftEstimate} onChange={(e) => setDraftEstimate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button
                    loading={updateTask.isPending}
                    onClick={() => {
                      const body: Record<string, unknown> = {
                        title: draftTitle,
                        description: draftDescription || null,
                        priority: draftPriority,
                      };
                      if (draftDue) body.dueDate = new Date(draftDue).toISOString();
                      else body.dueDate = null;
                      if (draftEstimate) body.estimateHours = Number(draftEstimate);
                      else body.estimateHours = null;
                      updateTask.mutate(body);
                    }}
                  >
                    Save changes
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Description</CardTitle></CardHeader>
              <CardBody>
                {t.description ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.description}</p>
                ) : (
                  <p className="text-sm text-[color:var(--color-fg-subtle)] italic">No description provided.</p>
                )}
              </CardBody>
            </Card>
          )}

          <SubtasksPanel taskId={t.id} projectId={t.projectId} />
          <DependenciesPanel taskId={t.id} projectId={t.projectId} />

          {/* Comments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Comments</CardTitle>
                <Badge tone="neutral">{commentItems.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <CommentForm onAdd={(body) => addComment.mutate(body)} pending={addComment.isPending} />
              {comments.isLoading ? (
                <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              ) : commentItems.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="h-8 w-8 mx-auto text-[color:var(--color-fg-subtle)] mb-2" />
                  <p className="text-sm text-[color:var(--color-fg-muted)]">No comments yet. Be the first.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {commentItems.map((c) => (
                    <li key={c.id} className="flex gap-3 pt-3 border-t border-[color:var(--color-border)] first:border-t-0 first:pt-0">
                      <Avatar size="sm" name={c.author?.name ?? c.author?.email} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{c.author?.name ?? c.author?.email ?? 'Unknown'}</p>
                          <span className="text-[11px] text-[color:var(--color-fg-muted)]">{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <Card>
            <CardBody className="space-y-4 text-sm">
              <SidebarRow icon={Tag} label="Status">
                <Select
                  className="h-8 text-xs"
                  value={t.status?.id ?? t.taskStatusId ?? ''}
                  onChange={(e) => changeStatus.mutate(e.target.value)}
                  disabled={changeStatus.isPending || !statusItems.length}
                >
                  {statusItems.length === 0 && <option value="">Loading…</option>}
                  {statusItems.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </Select>
              </SidebarRow>

              <SidebarRow icon={Tag} label="Priority">
                <Select
                  className="h-8 text-xs"
                  value={t.priority ?? 'MEDIUM'}
                  onChange={(e) => updateTask.mutate({ priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </SidebarRow>

              <SidebarRow icon={User} label="Assignee">
                <Select
                  className="h-8 text-xs"
                  value={t.assignee?.id ?? t.assigneeId ?? ''}
                  onChange={(e) => reassign.mutate(e.target.value)}
                  disabled={reassign.isPending}
                >
                  <option value="">Unassigned</option>
                  {userItems.map((u) => (<option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>))}
                </Select>
              </SidebarRow>

              <SidebarRow icon={Calendar} label="Due date">
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={t.dueDate ? t.dueDate.slice(0, 10) : ''}
                  onChange={(e) => updateTask.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </SidebarRow>

              <SidebarRow icon={Clock} label="Created" hint>
                <span>{t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</span>
              </SidebarRow>
            </CardBody>
          </Card>

          {!editing && (
            <Button variant="secondary" className="w-full" onClick={startEdit}>
              Edit description & details
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)]"
            onClick={() => {
              if (confirm(`Delete task ${t.key}? This cannot be undone.`)) remove.mutate();
            }}
            loading={remove.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete task
          </Button>
        </aside>
      </div>
    </div>
  );
}

function SidebarRow({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] font-semibold">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {hint ? <div className="text-xs text-[color:var(--color-fg-muted)]">{children}</div> : <div>{children}</div>}
    </div>
  );
}

function CommentForm({ onAdd, pending }: { onAdd: (body: string) => void; pending: boolean }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue('');
      }}
      className="space-y-2"
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write a comment…"
        rows={2}
        className="min-h-16 text-sm"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending} disabled={!value.trim()}>
          <MessageSquare className="h-3.5 w-3.5" /> Comment
        </Button>
      </div>
    </form>
  );
}

type SubTask = { id: string; key: string; title: string; status?: { name: string }; assignee?: { id: string; name?: string; email?: string } };
type Dep = { id: string; type?: string; dependsOnTask?: SubTask; requiredByTask?: SubTask };
type SimpleTask = { id: string; key: string; title: string };

function SubtasksPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const list = useQuery({
    queryKey: ['task', taskId, 'subtasks'],
    queryFn: async () => {
      const res = await get<{ items: SubTask[] } | SubTask[]>('/tasks', { parentTaskId: taskId, limit: 100 });
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  const statuses = useQuery({
    queryKey: ['task-statuses', projectId],
    queryFn: () => get<{ items?: { id: string; isDefault?: boolean }[] } | { id: string; isDefault?: boolean }[]>('/task-statuses', { projectId }),
    enabled: adding,
  });

  const create = useMutation({
    mutationFn: () => {
      const sList = Array.isArray(statuses.data) ? statuses.data : statuses.data?.items ?? [];
      const def = sList.find((s) => s.isDefault) ?? sList[0];
      if (!def) throw new Error('No status configured for this project');
      return post('/tasks', {
        projectId,
        parentTaskId: taskId,
        statusId: def.id,
        title: title.trim(),
        priority: 'MEDIUM',
      });
    },
    onSuccess: () => {
      toast.success('Sub-task added');
      setTitle('');
      qc.invalidateQueries({ queryKey: ['task', taskId, 'subtasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const items = list.data ?? [];
  const done = items.filter((s) => s.status?.name?.toLowerCase().includes('done')).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Sub-tasks
            {items.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[color:var(--color-fg-muted)]">{done}/{items.length} done</span>
            )}
          </CardTitle>
          <Button size="sm" variant={adding ? 'ghost' : 'secondary'} onClick={() => { setAdding((v) => !v); setTitle(''); }}>
            {adding ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> Add sub-task</>}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {items.length > 0 && (
          <div className="px-5 pt-3">
            <div className="h-1.5 w-full bg-[color:var(--color-surface-2)] rounded-full overflow-hidden">
              <div className="h-full bg-[color:var(--color-success)] transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
          </div>
        )}
        {adding && (
          <div className="px-5 py-3 border-b border-[color:var(--color-border)] flex items-center gap-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); if (title.trim()) create.mutate(); }
                if (e.key === 'Escape') { setAdding(false); setTitle(''); }
              }}
              placeholder="Sub-task title…  (Enter to add, Esc to cancel)"
              className="flex-1"
            />
            <Button size="sm" onClick={() => title.trim() && create.mutate()} loading={create.isPending} disabled={!title.trim()}>
              Add
            </Button>
          </div>
        )}
        {list.isLoading ? (
          <div className="p-5 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : items.length === 0 && !adding ? (
          <div className="text-center py-6 px-4">
            <GitBranch className="h-8 w-8 mx-auto text-[color:var(--color-fg-subtle)] mb-2" />
            <p className="text-sm text-[color:var(--color-fg-muted)]">Break this task into smaller sub-tasks.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border)]">
            {items.map((s) => {
              const isDone = s.status?.name?.toLowerCase().includes('done');
              return (
                <li key={s.id}>
                  <Link href={`/tasks/${s.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[color:var(--color-surface-2)] transition-colors">
                    <GitBranch className="h-3.5 w-3.5 text-[color:var(--color-fg-muted)] flex-shrink-0" />
                    <span className="font-mono text-[10px] text-[color:var(--color-fg-muted)] flex-shrink-0">{s.key}</span>
                    <span className={`flex-1 truncate text-sm ${isDone ? 'line-through text-[color:var(--color-fg-muted)]' : ''}`}>{s.title}</span>
                    {s.status?.name && <Badge tone={isDone ? 'success' : 'primary'} size="sm">{s.status.name}</Badge>}
                    {s.assignee && <Avatar size="xs" name={s.assignee.name ?? s.assignee.email} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DependenciesPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [linkType, setLinkType] = useState<'BLOCKED_BY' | 'BLOCKS' | 'RELATES_TO'>('BLOCKED_BY');
  const [otherId, setOtherId] = useState('');

  const detail = useQuery({
    queryKey: ['task', taskId, 'links'],
    queryFn: async () => {
      const t = await get<{ dependsOn?: Dep[]; requiredBy?: Dep[] }>(`/tasks/${taskId}`);
      return t;
    },
  });

  const candidates = useQuery({
    queryKey: ['tasks', 'for-link', projectId],
    queryFn: () => get<{ items: SimpleTask[] }>('/tasks', { projectId, limit: 100 }),
    enabled: adding,
  });

  const link = useMutation({
    mutationFn: () => post(`/tasks/${taskId}/dependencies`, {
      ...(linkType === 'BLOCKED_BY'
        ? { dependsOnTaskId: otherId, type: 'FINISH_TO_START' }
        : linkType === 'BLOCKS'
        ? { requiredById: otherId, type: 'FINISH_TO_START' }
        : { dependsOnTaskId: otherId, type: 'RELATES_TO' }),
    }),
    onSuccess: () => {
      toast.success('Link added');
      setAdding(false);
      setOtherId('');
      qc.invalidateQueries({ queryKey: ['task', taskId, 'links'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const unlink = useMutation({
    mutationFn: (depId: string) => del(`/tasks/${taskId}/dependencies/${depId}`),
    onSuccess: () => {
      toast.success('Link removed');
      qc.invalidateQueries({ queryKey: ['task', taskId, 'links'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const dependsOn = detail.data?.dependsOn ?? [];
  const requiredBy = detail.data?.requiredBy ?? [];
  const total = dependsOn.length + requiredBy.length;
  const otherTasks = (candidates.data?.items ?? []).filter((t) => t.id !== taskId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Linked issues
            {total > 0 && <span className="ml-2 text-xs font-normal text-[color:var(--color-fg-muted)]">{total}</span>}
          </CardTitle>
          <Button size="sm" variant={adding ? 'ghost' : 'secondary'} onClick={() => { setAdding((v) => !v); setOtherId(''); }}>
            {adding ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Link2 className="h-3.5 w-3.5" /> Add link</>}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {adding && (
          <div className="px-5 py-3 border-b border-[color:var(--color-border)] grid grid-cols-[150px_1fr_auto] gap-2">
            <Select value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)}>
              <option value="BLOCKED_BY">Blocked by</option>
              <option value="BLOCKS">Blocks</option>
              <option value="RELATES_TO">Relates to</option>
            </Select>
            <Select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
              <option value="">Select task…</option>
              {otherTasks.map((t) => (<option key={t.id} value={t.id}>{t.key} · {t.title}</option>))}
            </Select>
            <Button size="sm" onClick={() => otherId && link.mutate()} loading={link.isPending} disabled={!otherId}>Link</Button>
          </div>
        )}
        {detail.isLoading ? (
          <div className="p-5"><Skeleton className="h-10" /></div>
        ) : total === 0 ? (
          <div className="text-center py-6 px-4">
            <Link2 className="h-8 w-8 mx-auto text-[color:var(--color-fg-subtle)] mb-2" />
            <p className="text-sm text-[color:var(--color-fg-muted)]">No linked issues yet.</p>
          </div>
        ) : (
          <div>
            <DepGroup label="Blocked by" deps={dependsOn} taskKey="dependsOnTask" onUnlink={(id) => unlink.mutate(id)} />
            <DepGroup label="Blocks" deps={requiredBy} taskKey="requiredByTask" onUnlink={(id) => unlink.mutate(id)} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DepGroup({ label, deps, taskKey, onUnlink }: { label: string; deps: Dep[]; taskKey: 'dependsOnTask' | 'requiredByTask'; onUnlink: (id: string) => void }) {
  if (deps.length === 0) return null;
  return (
    <div className="border-b border-[color:var(--color-border)] last:border-b-0">
      <p className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-[color:var(--color-fg-muted)]">{label}</p>
      <ul>
        {deps.map((d) => {
          const linked = d[taskKey];
          if (!linked) return null;
          return (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2 hover:bg-[color:var(--color-surface-2)] group">
              <Link href={`/tasks/${linked.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-[10px] text-[color:var(--color-fg-muted)]">{linked.key}</span>
                <span className="text-sm truncate">{linked.title}</span>
                {linked.status?.name && <Badge tone="primary" size="sm">{linked.status.name}</Badge>}
              </Link>
              <button
                type="button"
                onClick={() => onUnlink(d.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface)]"
                aria-label="Remove link"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
