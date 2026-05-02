'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';
import { useCurrentUser } from '@/lib/roles';

type TodayAttendance = { status?: string; checkInAt?: string | null; checkOutAt?: string | null } | null;
type Task = { id: string; key: string; title: string; status?: { name: string }; priority?: string; dueDate?: string };
type Balance = { leaveTypeId?: string; leaveTypeName?: string; balance?: number; remaining?: number };
type LeaveReq = { id: string; startDate: string; endDate: string; status: string; leaveType?: { name?: string } };
type WfhReq = { id: string; requestDate?: string; status?: string };
type Notification = { id: string; title?: string; body?: string; eventType?: string; isRead?: boolean; createdAt?: string };

export default function MyDayPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const greeting = greet();
  const firstName = (user?.fullName ?? user?.email ?? 'there').split(/[\s@.]/).filter(Boolean)[0] ?? 'there';

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => get<TodayAttendance>('/attendance/today') });
  const myTasks = useQuery({ queryKey: ['tasks', 'me'], queryFn: () => get<{ items: Task[] }>('/tasks', { assigneeId: user?.id, limit: 20 }), enabled: !!user?.id });
  const balances = useQuery({ queryKey: ['leave', 'balance', 'me'], queryFn: () => get<Balance[] | { items?: Balance[] }>('/leave/balance/me') });
  const wfhBal = useQuery({ queryKey: ['wfh', 'balance', 'me'], queryFn: () => get<{ balance?: number; remaining?: number }>('/wfh/balance/me') });
  const leaveReqs = useQuery({ queryKey: ['leave', 'requests'], queryFn: () => get<{ items?: LeaveReq[] } | LeaveReq[]>('/leave/requests') });
  const wfhReqs = useQuery({ queryKey: ['wfh', 'requests'], queryFn: () => get<{ items?: WfhReq[] } | WfhReq[]>('/wfh/requests') });
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items?: Notification[] } | Notification[]>('/notifications', { limit: 10 }) });

  const punchIn = useMutation({
    mutationFn: () => post('/attendance/check-in', {}),
    onSuccess: () => { toast.success('Punched in'); qc.invalidateQueries({ queryKey: ['attendance', 'today'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const punchOut = useMutation({
    mutationFn: () => post('/attendance/check-out', {}),
    onSuccess: () => { toast.success('Punched out'); qc.invalidateQueries({ queryKey: ['attendance', 'today'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const checkedIn = !!today.data?.checkInAt;
  const checkedOut = !!today.data?.checkOutAt;
  const tasks = myTasks.data?.items ?? [];
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length;
  const balanceItems = Array.isArray(balances.data) ? balances.data : balances.data?.items ?? [];
  const totalLeave = balanceItems.reduce((s, b) => s + Number(b.balance ?? b.remaining ?? 0), 0);
  const wfhRemaining = wfhBal.data?.balance ?? wfhBal.data?.remaining ?? 0;

  const myLeaveReqs = (Array.isArray(leaveReqs.data) ? leaveReqs.data : leaveReqs.data?.items ?? []).slice(0, 3);
  const myWfhReqs = (Array.isArray(wfhReqs.data) ? wfhReqs.data : wfhReqs.data?.items ?? []).slice(0, 3);
  const recentNotifs = (Array.isArray(notifs.data) ? notifs.data : notifs.data?.items ?? []).slice(0, 5);

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} description="Here's what's on for you today." />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top: attendance hero + quick stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardBody className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] font-semibold">
                    {checkedIn && !checkedOut ? 'Working since' : checkedOut ? 'Worked today' : 'Not started yet'}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight mt-1">
                    {today.isLoading ? '—' : checkedIn ? new Date(today.data!.checkInAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '00:00'}
                    {checkedOut && (
                      <span className="text-base text-[color:var(--color-fg-muted)] font-normal ml-2">
                        → {new Date(today.data!.checkOutAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  {!checkedIn && (
                    <Button size="lg" onClick={() => punchIn.mutate()} loading={punchIn.isPending}>
                      <LogIn className="h-4 w-4" /> Punch in
                    </Button>
                  )}
                  {checkedIn && !checkedOut && (
                    <Button size="lg" variant="danger" onClick={() => punchOut.mutate()} loading={punchOut.isPending}>
                      <LogOut className="h-4 w-4" /> Punch out
                    </Button>
                  )}
                  {checkedOut && (
                    <Badge tone="success" className="h-9 px-4 text-sm">
                      ✓ All done for today
                    </Badge>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] font-semibold">Tasks today</p>
              <p className="text-3xl font-semibold tabular-nums mt-1">{myTasks.isLoading ? '—' : tasks.length}</p>
              {overdue > 0 && <p className="text-xs text-[color:var(--color-danger)] mt-1">{overdue} overdue</p>}
              <Link href="/tasks" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 mt-2 hover:underline">
                Open my tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>
        </div>

        {/* Balances row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BalanceCard label="Leave (total)" value={`${totalLeave} d`} hint="across all types" href="/leave" icon={CalendarDays} loading={balances.isLoading} />
          <BalanceCard label="Work from home" value={`${wfhRemaining} d`} hint="remaining" href="/wfh" icon={Home} loading={wfhBal.isLoading} />
          <BalanceCard label="My expenses" value="View" hint="submit / track" href="/expenses" icon={Receipt} />
          <BalanceCard label="Holidays" value="View" hint="upcoming" href="/holidays" icon={CalendarDays} />
        </div>

        {/* Tasks + recent activity row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My tasks</CardTitle>
                <Link href="/tasks" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {myTasks.isLoading ? (
                <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              ) : tasks.length === 0 ? (
                <EmptyState icon={ListChecks} title="No tasks assigned" description="Nothing on your plate right now. 🎉" />
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {tasks.slice(0, 8).map((t) => {
                    const isOverdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
                    return (
                      <li key={t.id}>
                        <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[color:var(--color-surface-2)] transition-colors">
                          <span className="font-mono text-[10px] text-[color:var(--color-fg-muted)] flex-shrink-0">{t.key}</span>
                          <span className="flex-1 truncate text-sm font-medium">{t.title}</span>
                          {t.status?.name && <Badge tone="primary" size="sm">{t.status.name}</Badge>}
                          {t.dueDate && (
                            <span className={`text-[11px] ${isOverdue ? 'text-[color:var(--color-danger)] font-medium' : 'text-[color:var(--color-fg-muted)]'}`}>
                              {isOverdue ? 'Overdue' : `Due ${new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent updates</CardTitle>
                  <Link href="/inbox" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                    Inbox <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {notifs.isLoading ? (
                  <div className="p-5 space-y-2"><Skeleton className="h-10" /></div>
                ) : recentNotifs.length === 0 ? (
                  <p className="p-5 text-sm text-[color:var(--color-fg-muted)] text-center italic">All caught up.</p>
                ) : (
                  <ul className="divide-y divide-[color:var(--color-border)]">
                    {recentNotifs.map((n) => (
                      <li key={n.id} className="px-4 py-2.5">
                        <p className="text-sm font-medium truncate">{n.title ?? n.eventType ?? 'Update'}</p>
                        {n.body && <p className="text-xs text-[color:var(--color-fg-muted)] line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-[color:var(--color-fg-subtle)] mt-0.5">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-[color:var(--color-brand-50)] to-white border-[color:var(--color-brand-200)]">
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[color:var(--color-primary)] text-white flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">On the go? Use WhatsApp.</p>
                    <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">
                      Send <span className="font-mono bg-white px-1 rounded">in</span> to punch in, <span className="font-mono bg-white px-1 rounded">tasks</span> to see your work, <span className="font-mono bg-white px-1 rounded">apply leave 2 days</span> to apply.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* My requests row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My leave requests</CardTitle>
                <Link href="/leave" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                  Apply <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {leaveReqs.isLoading ? (
                <div className="p-5 space-y-2"><Skeleton className="h-10" /></div>
              ) : myLeaveReqs.length === 0 ? (
                <p className="p-5 text-sm text-[color:var(--color-fg-muted)] text-center italic">No leave requests yet.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {myLeaveReqs.map((r) => (
                    <li key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.leaveType?.name ?? 'Leave'}</p>
                        <p className="text-xs text-[color:var(--color-fg-muted)]">
                          {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My WFH requests</CardTitle>
                <Link href="/wfh" className="text-xs text-[color:var(--color-primary)] font-medium inline-flex items-center gap-0.5 hover:underline">
                  Apply <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {wfhReqs.isLoading ? (
                <div className="p-5 space-y-2"><Skeleton className="h-10" /></div>
              ) : myWfhReqs.length === 0 ? (
                <p className="p-5 text-sm text-[color:var(--color-fg-muted)] text-center italic">No WFH requests yet.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {myWfhReqs.map((r) => (
                    <li key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.requestDate ? new Date(r.requestDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</p>
                      </div>
                      <Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status ?? 'PENDING'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function BalanceCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
  loading?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:bg-[color:var(--color-surface-2)] transition-colors">
        <CardBody>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4 text-[color:var(--color-primary)]" />
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">{label}</p>
          </div>
          {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-semibold tracking-tight">{value}</p>}
          {hint && <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-1">{hint}</p>}
        </CardBody>
      </Card>
    </Link>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
