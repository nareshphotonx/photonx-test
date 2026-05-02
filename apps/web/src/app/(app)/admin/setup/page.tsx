'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Circle,
  FolderKanban,
  ListChecks,
  MapPin,
  MessageSquare,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';

type Step = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  isDone: boolean | undefined;
};

export default function SetupChecklistPage() {
  // Probe each domain to compute completion. Fall back to false on errors.
  const tenant = useQuery({ queryKey: ['tenant', 'current'], queryFn: () => get<{ id?: string; name?: string }>('/tenants/current') });
  const office = useQuery({ queryKey: ['office-locations'], queryFn: () => get<{ items?: unknown[] } | unknown[]>('/office-locations') });
  const ips = useQuery({ queryKey: ['office-ips'], queryFn: () => get<{ items?: unknown[] } | unknown[]>('/office-ips') });
  const leaveTypes = useQuery({ queryKey: ['leave-types'], queryFn: () => get<{ items?: unknown[] } | unknown[]>('/leave-types') });
  const holidays = useQuery({ queryKey: ['holidays'], queryFn: () => get<{ items?: unknown[] } | unknown[]>('/holidays') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items?: unknown[]; total?: number }>('/users', { limit: 1 }) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => get<{ items?: unknown[] }>('/teams') });
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items?: unknown[]; total?: number }>('/projects', { limit: 1 }) });
  const tasks = useQuery({ queryKey: ['tasks', 'any'], queryFn: () => get<{ items?: unknown[]; total?: number }>('/tasks', { limit: 1 }) });

  const len = (q: typeof office) => {
    const d = q.data;
    if (!d) return 0;
    if (Array.isArray(d)) return d.length;
    if (typeof d === 'object' && 'total' in d && typeof (d as { total?: number }).total === 'number') return (d as { total: number }).total;
    if (typeof d === 'object' && 'items' in d) return ((d as { items?: unknown[] }).items ?? []).length;
    return 0;
  };

  const steps: Step[] = [
    { id: 'tenant', title: 'Workspace created', description: 'Your tenant is set up.', icon: Building2, href: '/settings/workspace', isDone: !!tenant.data?.id },
    { id: 'office', title: 'Add an office location', description: 'Required for location-based check-ins.', icon: MapPin, href: '/admin/office', isDone: len(office) > 0 },
    { id: 'ips', title: 'Add office IPs (optional)', description: 'For IP-based attendance verification.', icon: MapPin, href: '/admin/office', isDone: len(ips) > 0 },
    { id: 'leave-types', title: 'Configure leave types', description: 'Casual, sick, earned, etc.', icon: CalendarDays, href: '/admin/leave-types', isDone: len(leaveTypes) > 0 },
    { id: 'holidays', title: 'Set up holiday calendar', description: 'So leave & attendance work correctly.', icon: CalendarOff, href: '/holidays', isDone: len(holidays) > 0 },
    { id: 'users', title: 'Invite your team', description: 'Add users with email or WhatsApp number.', icon: Users, href: '/people/users', isDone: len(users) > 1 },
    { id: 'teams', title: 'Create teams', description: 'Group people for projects and approvals.', icon: Users, href: '/people/teams', isDone: len(teams) > 0 },
    { id: 'projects', title: 'Create your first project', description: 'Where work and tasks live.', icon: FolderKanban, href: '/projects', isDone: len(projects) > 0 },
    { id: 'task-statuses', title: 'Define task statuses', description: 'To do, in progress, done — your workflow.', icon: Workflow, href: '/admin/task-statuses', isDone: len(projects) > 0 },
    { id: 'tasks', title: 'Add a task', description: 'So your team has something to start on.', icon: ListChecks, href: '/tasks', isDone: len(tasks) > 0 },
    { id: 'whatsapp', title: 'Verify WhatsApp', description: 'Check the bot receives and replies to messages.', icon: MessageSquare, href: '/admin/whatsapp', isDone: undefined },
    { id: 'ai', title: 'Try the AI assistant', description: 'Ask something about your workspace.', icon: Sparkles, href: '/ai', isDone: undefined },
  ];

  const loading = tenant.isLoading || office.isLoading || users.isLoading;
  const knownDone = steps.filter((s) => s.isDone === true).length;
  const knownTotal = steps.filter((s) => s.isDone !== undefined).length;
  const pct = knownTotal > 0 ? Math.round((knownDone / knownTotal) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Setup checklist"
        description="Get your workspace ready in a few minutes. Tick items off as you go — non-required ones can wait."
      />
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <circle cx="18" cy="18" r="16" stroke="var(--color-surface-2)" strokeWidth="3" fill="none" />
                  <circle
                    cx="18" cy="18" r="16"
                    stroke="var(--color-primary)" strokeWidth="3" fill="none"
                    strokeDasharray={`${pct}, 100`} pathLength={100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{pct}%</div>
              </div>
              <div className="flex-1">
                <p className="font-semibold">Workspace setup</p>
                <p className="text-sm text-[color:var(--color-fg-muted)]">
                  {loading ? 'Checking your setup…' : `${knownDone} of ${knownTotal} required steps done`}
                </p>
              </div>
              <Badge tone={pct === 100 ? 'success' : 'primary'}>
                {pct === 100 ? 'All set' : 'In progress'}
              </Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Steps</CardTitle></CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="p-5 space-y-2">
                <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
              </div>
            ) : (
              <ul>
                {steps.map((s, i) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 hover:bg-[color:var(--color-surface-2)] transition-colors',
                        i !== steps.length - 1 && 'border-b border-[color:var(--color-border)]',
                      )}
                    >
                      <div className="flex-shrink-0">
                        {s.isDone ? (
                          <CheckCircle2 className="h-6 w-6 text-[color:var(--color-success)]" />
                        ) : (
                          <Circle className="h-6 w-6 text-[color:var(--color-fg-subtle)]" />
                        )}
                      </div>
                      <div className="h-9 w-9 rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)] flex items-center justify-center flex-shrink-0">
                        <s.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-medium', s.isDone && 'line-through text-[color:var(--color-fg-muted)]')}>{s.title}</p>
                        <p className="text-sm text-[color:var(--color-fg-muted)]">{s.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[color:var(--color-fg-subtle)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
