'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select, Skeleton } from '@/components/ui';
import { get, getApiErrorMessage, patch } from '@/lib/api';

type Tenant = {
  id?: string;
  name?: string;
  slug?: string;
  createdAt?: string;
  settings?: TenantSettings;
};

type TenantSettings = {
  timezone?: string;
  currency?: string;
  workWeekStart?: 'MONDAY' | 'SUNDAY' | 'SATURDAY';
  extras?: {
    workdayStart?: string;       // "09:00"
    workdayEnd?: string;         // "18:00"
    lateMarkMinutes?: number;
    workingDays?: string[];      // ["MON","TUE",...]
  } & Record<string, unknown>;
};

const DAYS = [
  { id: 'MON', label: 'Mon' },
  { id: 'TUE', label: 'Tue' },
  { id: 'WED', label: 'Wed' },
  { id: 'THU', label: 'Thu' },
  { id: 'FRI', label: 'Fri' },
  { id: 'SAT', label: 'Sat' },
  { id: 'SUN', label: 'Sun' },
];

const COMMON_TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];
const COMMON_CCY = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

export default function WorkspaceSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['tenant', 'current'], queryFn: () => get<Tenant>('/tenants/current') });

  // Local form state, hydrated when tenant loads
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [workWeekStart, setWorkWeekStart] = useState<'MONDAY' | 'SUNDAY' | 'SATURDAY'>('MONDAY');
  const [workdayStart, setWorkdayStart] = useState('09:00');
  const [workdayEnd, setWorkdayEnd] = useState('18:00');
  const [lateMarkMinutes, setLateMarkMinutes] = useState('15');
  const [workingDays, setWorkingDays] = useState<Set<string>>(new Set(['MON', 'TUE', 'WED', 'THU', 'FRI']));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      const s = data.settings ?? {};
      const e = s.extras ?? {};
      if (s.timezone) setTimezone(s.timezone);
      if (s.currency) setCurrency(s.currency);
      if (s.workWeekStart) setWorkWeekStart(s.workWeekStart);
      if (typeof e.workdayStart === 'string') setWorkdayStart(e.workdayStart);
      if (typeof e.workdayEnd === 'string') setWorkdayEnd(e.workdayEnd);
      if (typeof e.lateMarkMinutes === 'number') setLateMarkMinutes(String(e.lateMarkMinutes));
      if (Array.isArray(e.workingDays)) setWorkingDays(new Set(e.workingDays));
      setHydrated(true);
    }
  }, [data, hydrated]);

  const save = useMutation({
    mutationFn: () => patch('/tenants/current/settings', {
      timezone,
      currency,
      workWeekStart,
      extras: {
        workdayStart,
        workdayEnd,
        lateMarkMinutes: Number(lateMarkMinutes) || 0,
        workingDays: Array.from(workingDays),
      },
    }),
    onSuccess: () => { toast.success('Workspace settings saved'); qc.invalidateQueries({ queryKey: ['tenant', 'current'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const toggleDay = (id: string) => {
    setWorkingDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Workspace details</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Name</Label><Input value={data?.name ?? ''} readOnly /></div>
          <div><Label>Slug</Label><Input value={data?.slug ?? ''} readOnly className="font-mono text-xs" /></div>
          <div><Label>ID</Label><Input value={data?.id ?? ''} readOnly className="font-mono text-xs" /></div>
          <div><Label>Created</Label><Input value={data?.createdAt ? new Date(data.createdAt).toLocaleString() : ''} readOnly /></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locale & money</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="tz">Timezone</Label>
            <Select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {COMMON_TZ.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ccy">Default currency</Label>
            <Select id="ccy" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {COMMON_CCY.map((c) => (<option key={c} value={c}>{c}</option>))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wws">Week starts on</Label>
            <Select id="wws" value={workWeekStart} onChange={(e) => setWorkWeekStart(e.target.value as typeof workWeekStart)}>
              <option value="MONDAY">Monday</option>
              <option value="SUNDAY">Sunday</option>
              <option value="SATURDAY">Saturday</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Office hours</CardTitle>
          <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">Used to flag late check-ins, early check-outs, and to compute working hours.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="wd-start">Workday start</Label>
              <Input id="wd-start" type="time" value={workdayStart} onChange={(e) => setWorkdayStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wd-end">Workday end</Label>
              <Input id="wd-end" type="time" value={workdayEnd} onChange={(e) => setWorkdayEnd(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="late">Late mark after (min)</Label>
              <Input id="late" type="number" min="0" max="120" value={lateMarkMinutes} onChange={(e) => setLateMarkMinutes(e.target.value)} />
              <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-1">e.g. 15 = mark late if check-in is &gt; 15 min after start</p>
            </div>
          </div>
          <div>
            <Label>Working days</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const active = workingDays.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`h-9 w-12 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]'
                        : 'border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:border-[color:var(--color-border-strong)]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} loading={save.isPending}>Save workspace settings</Button>
      </div>
    </div>
  );
}
