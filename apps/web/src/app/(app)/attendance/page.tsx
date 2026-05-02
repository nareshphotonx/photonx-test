'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, LogIn, LogOut, MapPin } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Today = { status?: string; checkInAt?: string | null; checkOutAt?: string | null } | null;
type Report = { date: string; status?: string; checkInAt?: string | null; checkOutAt?: string | null };

export default function AttendancePage() {
  const qc = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 },
      );
    }
  }, []);

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => get<Today>('/attendance/today') });
  const report = useQuery({
    queryKey: ['attendance', 'report'],
    queryFn: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return get<{ items?: Report[] } | Report[]>('/attendance/report', { from: from.toISOString(), to: to.toISOString() });
    },
  });

  const punchIn = useMutation({
    mutationFn: () => post('/attendance/check-in', coords ?? {}),
    onSuccess: () => { toast.success('Punched in'); qc.invalidateQueries({ queryKey: ['attendance'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const punchOut = useMutation({
    mutationFn: () => post('/attendance/check-out', coords ?? {}),
    onSuccess: () => { toast.success('Punched out'); qc.invalidateQueries({ queryKey: ['attendance'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const checkedIn = !!today.data?.checkInAt;
  const checkedOut = !!today.data?.checkOutAt;
  const items = Array.isArray(report.data) ? report.data : report.data?.items ?? [];

  const elapsed = (() => {
    if (!today.data?.checkInAt) return '--:--:--';
    const start = new Date(today.data.checkInAt).getTime();
    const end = today.data.checkOutAt ? new Date(today.data.checkOutAt).getTime() : (now ?? new Date()).getTime();
    const ms = Math.max(0, end - start);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  return (
    <>
      <PageHeader title="Attendance" description={now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''} />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardBody className="text-center py-10">
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] font-semibold">
                {checkedIn && !checkedOut ? 'Working since' : checkedOut ? 'Worked today' : 'Ready to start'}
              </p>
              <p className="text-5xl font-semibold tabular-nums tracking-tight mt-3">{elapsed}</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[color:var(--color-fg-muted)]">
                {today.data?.checkInAt && <span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5" /> {new Date(today.data.checkInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                {today.data?.checkOutAt && <span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5" /> {new Date(today.data.checkOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                {coords && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location detected</span>}
              </div>
              <div className="mt-6 max-w-xs mx-auto">
                {!checkedIn && <Button size="xl" className="w-full" loading={punchIn.isPending} onClick={() => punchIn.mutate()}><LogIn className="h-4 w-4" /> Punch in</Button>}
                {checkedIn && !checkedOut && <Button size="xl" variant="danger" className="w-full" loading={punchOut.isPending} onClick={() => punchOut.mutate()}><LogOut className="h-4 w-4" /> Punch out</Button>}
                {checkedOut && <div className="bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] rounded-lg py-3 px-4 text-sm font-medium">✓ All done for today</div>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>This month</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <Stat label="Days present" value={items.filter(i => i.checkInAt).length} />
              <Stat label="On time" value={items.filter(i => i.status === 'PRESENT').length} />
              <Stat label="Late" value={items.filter(i => i.status?.includes('LATE')).length} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent days</CardTitle></CardHeader>
          <CardBody className="p-0">
            {report.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : items.length === 0 ? (
              <EmptyState icon={Briefcase} title="No history" />
            ) : (
              <Table>
                <THead><TR><TH>Date</TH><TH>Check in</TH><TH>Check out</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {items.slice(0, 30).map((it, i) => (
                    <TR key={i}>
                      <TD className="font-medium">{new Date(it.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</TD>
                      <TD className="text-[color:var(--color-fg-muted)]">{it.checkInAt ? new Date(it.checkInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</TD>
                      <TD className="text-[color:var(--color-fg-muted)]">{it.checkOutAt ? new Date(it.checkOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</TD>
                      <TD><Badge tone={it.status?.includes('PRESENT') || it.status === 'CHECKED_IN' ? 'success' : it.status?.includes('LATE') ? 'warning' : it.status?.includes('ABSENT') ? 'danger' : 'neutral'}>{it.status ?? 'PRESENT'}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-[color:var(--color-fg-muted)]">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
