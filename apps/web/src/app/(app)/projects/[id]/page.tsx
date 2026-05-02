'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ListChecks,
  MoreHorizontal,
  Plus,
  Receipt,
  Target,
  TrendingUp,
  Trash2,
  User,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownTrigger,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  Textarea,
} from '@/components/ui';
import { del, get, getApiErrorMessage, patch, post } from '@/lib/api';

type Project = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED';
  startDate?: string | null;
  endDate?: string | null;
  ownerId?: string;
  owner?: { id: string; name?: string; email?: string } | null;
  team?: { id: string; name?: string } | null;
  teamId?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  createdAt?: string;
};

type TaskRow = {
  id: string;
  key: string;
  title: string;
  status?: { name: string };
  assignee?: { id: string; name?: string; email?: string } | null;
  dueDate?: string | null;
};

type Milestone = { id: string; name: string; description?: string; dueDate?: string; status?: string };
type Team = { id: string; name: string };
type Dash = {
  kpis?: { efficiency?: number; utilization?: number; completionRate?: number };
  financials?: { totalBurn?: number; margin?: number; budget?: number };
  taskCounts?: { total?: number; done?: number; inProgress?: number; todo?: number };
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const project = useQuery({ queryKey: ['project', id], queryFn: () => get<Project>(`/projects/${id}`) });
  const tasks = useQuery({ queryKey: ['tasks', 'by-project', id], queryFn: () => get<{ items: TaskRow[]; total?: number }>('/tasks', { projectId: id, limit: 50 }) });
  const milestones = useQuery({
    queryKey: ['milestones', id],
    queryFn: async () => {
      try { return await get<{ items?: Milestone[] } | Milestone[]>(`/projects/${id}/milestones`); }
      catch { return []; }
    },
  });
  const dash = useQuery({
    queryKey: ['dashboard', 'project', id],
    queryFn: async () => {
      try { return await get<Dash>(`/dashboard/project/${id}`); }
      catch { return null; }
    },
  });

  const [editOpen, setEditOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => del(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      router.replace('/projects');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (project.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (project.error || !project.data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
        <ErrorBanner error={project.error ?? new Error('Project not found')} onRetry={project.refetch} />
      </div>
    );
  }

  const p = project.data;
  const taskItems = tasks.data?.items ?? [];
  const milestoneItems = Array.isArray(milestones.data) ? milestones.data : (milestones.data as { items?: Milestone[] } | null)?.items ?? [];

  const taskCounts = dash.data?.taskCounts ?? { total: taskItems.length };
  const burn = dash.data?.financials?.totalBurn;
  const margin = dash.data?.financials?.margin;
  const efficiency = dash.data?.kpis?.efficiency;
  const completionRate = dash.data?.kpis?.completionRate;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/projects" className="inline-flex items-center gap-1 hover:text-[color:var(--color-fg)]">
            <ArrowLeft className="h-3 w-3" /> Projects
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-3">
            <span className="h-9 w-9 rounded-md bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] inline-flex items-center justify-center text-sm font-bold">
              {p.code?.slice(0, 2).toUpperCase()}
            </span>
            <span>{p.name}</span>
          </span>
        }
        description={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono text-xs">{p.code}</span>
            {p.status && <Badge tone={p.status === 'ACTIVE' ? 'primary' : 'neutral'}>{p.status}</Badge>}
            {p.team?.name && <span className="text-xs">· {p.team.name} team</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/tasks?projectId=${p.id}`}>
              <Button variant="secondary"><ListChecks className="h-4 w-4" /> View tasks</Button>
            </Link>
            <Button onClick={() => setEditOpen(true)}>Edit project</Button>
            <DropdownRoot>
              <DropdownTrigger asChild>
                <button className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)]">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem icon={Trash2} destructive onSelect={() => {
                  if (confirm(`Delete project ${p.code}? Tasks will be archived.`)) remove.mutate();
                }}>
                  Delete project
                </DropdownItem>
              </DropdownContent>
            </DropdownRoot>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <BudgetAlert burn={burn} budget={p.budgetAmount} currency={p.budgetCurrency ?? '₹'} />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Tasks" value={taskCounts?.total ?? taskItems.length} icon={ListChecks} hint={`${taskCounts?.done ?? 0} done · ${taskCounts?.inProgress ?? 0} in progress`} />
          <Stat label="Completion rate" value={completionRate != null ? `${(completionRate * 100).toFixed(0)}%` : '—'} icon={CheckCircle2} loading={dash.isLoading} />
          <Stat label="Efficiency" value={efficiency != null ? `${(efficiency * 100).toFixed(0)}%` : '—'} icon={TrendingUp} loading={dash.isLoading} />
          <Stat
            label="Burn"
            value={burn != null ? `${p.budgetCurrency ?? '₹'} ${burn.toLocaleString()}` : '—'}
            icon={Receipt}
            hint={p.budgetAmount ? `Budget ${p.budgetCurrency ?? '₹'} ${Number(p.budgetAmount).toLocaleString()}${margin != null ? ` · margin ${(margin * 100).toFixed(0)}%` : ''}` : undefined}
            loading={dash.isLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Description + meta */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>About</CardTitle></CardHeader>
            <CardBody>
              {p.description ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{p.description}</p>
              ) : (
                <p className="text-sm text-[color:var(--color-fg-subtle)] italic">No description.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Detail icon={User} label="Owner" value={p.owner?.name ?? p.owner?.email ?? '—'} />
              <Detail icon={Briefcase} label="Team" value={p.team?.name ?? '—'} />
              <Detail icon={Calendar} label="Start" value={p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'} />
              <Detail icon={Calendar} label="End" value={p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'} />
              <Detail icon={Receipt} label="Budget" value={p.budgetAmount ? `${p.budgetCurrency ?? '₹'} ${Number(p.budgetAmount).toLocaleString()}` : '—'} />
              <Detail icon={Clock} label="Created" value={p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'} />
            </CardBody>
          </Card>
        </div>

        {/* Milestones */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Milestones</CardTitle>
              <CreateMilestoneButton projectId={id} onCreated={() => qc.invalidateQueries({ queryKey: ['milestones', id] })} />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {milestones.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : milestoneItems.length === 0 ? (
              <EmptyState icon={Target} title="No milestones yet" description="Group related tasks under a milestone to track delivery." />
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {milestoneItems.map((m) => (
                  <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{m.name}</p>
                      {m.description && <p className="text-xs text-[color:var(--color-fg-muted)] mt-0.5">{m.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[color:var(--color-fg-muted)]">
                      {m.dueDate && <span>Due {new Date(m.dueDate).toLocaleDateString()}</span>}
                      {m.status && <Badge tone="neutral">{m.status}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tasks preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent tasks</CardTitle>
              <Link href={`/tasks?projectId=${p.id}`} className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {tasks.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : taskItems.length === 0 ? (
              <EmptyState icon={ListChecks} title="No tasks yet" description="Add tasks to start tracking work in this project." />
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {taskItems.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[color:var(--color-surface-2)] transition-colors">
                      <span className="font-mono text-[11px] text-[color:var(--color-fg-muted)] flex-shrink-0">{t.key}</span>
                      <span className="flex-1 truncate text-sm font-medium">{t.title}</span>
                      {t.status?.name && <Badge tone="primary" size="sm">{t.status.name}</Badge>}
                      {t.assignee && <Avatar size="xs" name={t.assignee.name ?? t.assignee.email} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={p} onSaved={() => qc.invalidateQueries({ queryKey: ['project', id] })} />
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-3.5 w-3.5 text-[color:var(--color-fg-muted)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] font-semibold">{label}</p>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function CreateMilestoneButton({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: () => post('/milestones', {
      projectId,
      name,
      description: description || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    }),
    onSuccess: () => {
      toast.success('Milestone added');
      setName(''); setDescription(''); setDueDate('');
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add milestone</Button>
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="New milestone" />
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
            <DialogBody className="space-y-4">
              <div><Label htmlFor="ms-name" required>Name</Label><Input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Beta release" /></div>
              <div><Label htmlFor="ms-desc">Description</Label><Textarea id="ms-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this milestone cover?" /></div>
              <div><Label htmlFor="ms-due">Due date</Label><Input id="ms-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add milestone</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function EditProjectDialog({ open, onOpenChange, project, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; project: Project; onSaved: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [status, setStatus] = useState<Project['status']>(project.status ?? 'ACTIVE');
  const [teamId, setTeamId] = useState(project.team?.id ?? project.teamId ?? '');
  const [budget, setBudget] = useState(project.budgetAmount?.toString() ?? '');
  const [budgetCcy, setBudgetCcy] = useState(project.budgetCurrency ?? 'INR');

  const teams = useQuery({ queryKey: ['teams'], queryFn: () => get<{ items: Team[] }>('/teams') });

  const save = useMutation({
    mutationFn: () => patch(`/projects/${project.id}`, {
      name,
      description: description || null,
      status,
      teamId: teamId || null,
      budgetAmount: budget ? Number(budget) : null,
      budgetCurrency: budget ? budgetCcy : null,
    }),
    onSuccess: () => { toast.success('Project updated'); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Edit project" description={project.code} />
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="p-name" required>Name</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-status">Status</Label>
                <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="p-team">Team</Label>
                <Select id="p-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {(teams.data?.items ?? []).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="p-budget">Budget</Label>
                <Input id="p-budget" type="number" step="0.01" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="200000" />
              </div>
              <div>
                <Label htmlFor="p-ccy">Currency</Label>
                <Select id="p-ccy" value={budgetCcy} onChange={(e) => setBudgetCcy(e.target.value)}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function BudgetAlert({ burn, budget, currency }: { burn?: number | null; budget?: number | null; currency: string }) {
  if (burn == null || !budget) return null;
  const ratio = burn / Number(budget);
  if (ratio < 0.8) return null;
  const pct = Math.round(ratio * 100);
  // Tier: 80-99% warning, 100-119% danger, 120%+ critical
  const tier = ratio >= 1.2 ? 'critical' : ratio >= 1.0 ? 'over' : 'warning';
  const styles = {
    warning: { bg: 'bg-[color:var(--color-warning-soft)]', border: 'border-amber-200', text: 'text-[color:var(--color-warning)]', icon: '⚠️', label: 'Approaching budget' },
    over: { bg: 'bg-[color:var(--color-danger-soft)]', border: 'border-red-200', text: 'text-[color:var(--color-danger)]', icon: '🚨', label: 'Budget exceeded' },
    critical: { bg: 'bg-[color:var(--color-danger-soft)]', border: 'border-red-300', text: 'text-[color:var(--color-danger)]', icon: '🔥', label: 'Critical: 120%+ over budget' },
  } as const;
  const s = styles[tier];
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${s.bg} ${s.border}`}>
      <span className="text-xl">{s.icon}</span>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${s.text}`}>
          {s.label} — {pct}% spent ({currency} {burn.toLocaleString()} of {currency} {Number(budget).toLocaleString()})
        </p>
        <div className="h-1.5 w-full bg-white/50 rounded-full overflow-hidden mt-2">
          <div
            className={`h-full transition-all ${tier === 'warning' ? 'bg-[color:var(--color-warning)]' : 'bg-[color:var(--color-danger)]'}`}
            style={{ width: `${Math.min(ratio, 1.5) * 100 / 1.5}%` }}
          />
        </div>
      </div>
    </div>
  );
}
