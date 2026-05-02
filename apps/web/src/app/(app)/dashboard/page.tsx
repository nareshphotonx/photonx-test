'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui';
import { get } from '@/lib/api';

type DashboardData = {
  scope: string;
  kpis?: {
    efficiency?: number;
    utilization?: number;
    completionRate?: number;
    delayRate?: number;
    reopenRate?: number;
  };
};

type Task = { id: string; key: string; title: string; status?: { name: string }; priority?: string; dueDate?: string };
type Project = { id: string; name: string; code: string; status?: string };

const taskTrend = [
  { day: 'Mon', completed: 12, created: 18 },
  { day: 'Tue', completed: 15, created: 14 },
  { day: 'Wed', completed: 19, created: 22 },
  { day: 'Thu', completed: 22, created: 17 },
  { day: 'Fri', completed: 28, created: 21 },
  { day: 'Sat', completed: 8, created: 5 },
  { day: 'Sun', completed: 4, created: 3 },
];

const taskStatusData = [
  { name: 'Done', value: 42, color: '#16a34a' },
  { name: 'In progress', value: 28, color: '#0d9488' },
  { name: 'To do', value: 35, color: '#94a3b8' },
  { name: 'Blocked', value: 5, color: '#dc2626' },
];

export default function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard', 'super-admin'],
    queryFn: () => get<DashboardData>('/dashboard/super-admin'),
  });
  const tasks = useQuery({ queryKey: ['tasks', 'recent'], queryFn: () => get<{ items: Task[] }>('/tasks', { limit: 6 }) });
  const projects = useQuery({ queryKey: ['projects', 'recent'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 5 }) });
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => get<{ checkInAt?: string; checkOutAt?: string }>('/attendance/today') });
  const leave = useQuery({ queryKey: ['leave', 'balance', 'me'], queryFn: () => get<Array<{ leaveTypeName?: string; balance?: number }>>('/leave/balance/me') });

  const efficiency = dashboard.data?.kpis?.efficiency;
  const utilization = dashboard.data?.kpis?.utilization;
  const completionRate = dashboard.data?.kpis?.completionRate;
  const totalLeave = Array.isArray(leave.data) ? leave.data.reduce((s, b) => s + Number(b.balance ?? 0), 0) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your workspace at a glance"
        actions={
          <>
            <Link href="/ai">
              <Button variant="secondary" size="md">
                <Sparkles className="h-4 w-4" /> Ask AI
              </Button>
            </Link>
            <Link href="/projects">
              <Button size="md">
                <FolderKanban className="h-4 w-4" /> New project
              </Button>
            </Link>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Efficiency"
            value={efficiency != null ? `${(efficiency * 100).toFixed(0)}%` : '—'}
            hint="Output vs. estimated"
            icon={TrendingUp}
            loading={dashboard.isLoading}
            trend={efficiency != null ? { value: Math.round((efficiency - 1) * 100) } : undefined}
          />
          <Stat
            label="Utilization"
            value={utilization != null ? `${(utilization * 100).toFixed(0)}%` : '—'}
            hint="Logged vs. capacity"
            icon={Clock}
            loading={dashboard.isLoading}
          />
          <Stat
            label="Completion rate"
            value={completionRate != null ? `${(completionRate * 100).toFixed(0)}%` : '—'}
            hint="On-time completion"
            icon={CheckCircle2}
            loading={dashboard.isLoading}
          />
          <Stat
            label="Active projects"
            value={projects.data?.items?.length ?? 0}
            hint={`${tasks.data?.items?.length ?? 0} tasks tracked`}
            icon={FolderKanban}
            loading={projects.isLoading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Task velocity</CardTitle>
                <Badge tone="primary" dot>
                  This week
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="pt-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="created" fill="var(--color-brand-200)" name="Created" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="var(--color-brand-600)" name="Completed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task status</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {taskStatusData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      iconType="circle"
                      formatter={(v) => <span style={{ color: 'var(--color-fg-muted)' }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent tasks</CardTitle>
                <Link href="/tasks" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {tasks.isLoading ? (
                <div className="p-5 space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : !tasks.data?.items?.length ? (
                <EmptyState icon={ListChecks} title="No tasks yet" description="Create your first task to get going." />
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {tasks.data.items.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[color:var(--color-surface-2)] transition-colors">
                        <div className="h-8 w-8 rounded-md bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] inline-flex items-center justify-center flex-shrink-0">
                          <ListChecks className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-xs text-[color:var(--color-fg-muted)] font-mono mt-0.5">{t.key}</p>
                        </div>
                        {t.status?.name && <Badge tone="neutral">{t.status.name}</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My day</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <SummaryRow
                  icon={Briefcase}
                  label="Attendance"
                  value={today.data?.checkOutAt ? 'Done' : today.data?.checkInAt ? 'Working' : 'Not started'}
                  href="/attendance"
                  loading={today.isLoading}
                />
                <SummaryRow
                  icon={CalendarDays}
                  label="Leave balance"
                  value={`${totalLeave} days`}
                  href="/leave"
                  loading={leave.isLoading}
                />
                <SummaryRow icon={Activity} label="Pending approvals" value="2" href="/approvals" />
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-[color:var(--color-brand-50)] to-white border-[color:var(--color-brand-200)]">
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[color:var(--color-primary)] text-white flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">WhatsApp commands</p>
                    <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">
                      Send <span className="font-mono bg-white px-1 rounded text-[color:var(--color-primary)]">in</span> to punch in,
                      <span className="font-mono bg-white px-1 rounded text-[color:var(--color-primary)] mx-1">tasks</span> to list your work,
                      <span className="font-mono bg-white px-1 rounded text-[color:var(--color-primary)] ml-1">leave 2 days</span> to apply.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Recent projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active projects</CardTitle>
              <Link href="/projects" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {projects.isLoading ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : !projects.data?.items?.length ? (
              <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to organize your work." />
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.data.items.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block p-4 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-md bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] inline-flex items-center justify-center text-xs font-semibold">
                        {p.code?.slice(0, 2) ?? 'P'}
                      </div>
                      {p.status && <Badge tone="primary" size="sm">{p.status}</Badge>}
                    </div>
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-[color:var(--color-fg-muted)] font-mono mt-0.5">{p.code}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  href,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  href: string;
  loading?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-2 -m-2 rounded-md hover:bg-[color:var(--color-surface-2)] transition-colors">
      <div className="h-8 w-8 rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)] inline-flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[color:var(--color-fg-muted)]">{label}</p>
        {loading ? <Skeleton className="h-4 w-16 mt-0.5" /> : <p className="text-sm font-medium">{value}</p>}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
    </Link>
  );
}
