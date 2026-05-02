'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, CheckCircle2, Clock, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader, CardTitle, PageHeader, Stat } from '@/components/ui';
import { get } from '@/lib/api';

type Dash = { kpis?: { efficiency?: number; utilization?: number; completionRate?: number; delayRate?: number; reopenRate?: number } };

const trend = [
  { month: 'Jan', efficiency: 0.85, utilization: 0.72 },
  { month: 'Feb', efficiency: 0.88, utilization: 0.75 },
  { month: 'Mar', efficiency: 0.92, utilization: 0.78 },
  { month: 'Apr', efficiency: 0.95, utilization: 0.82 },
  { month: 'May', efficiency: 1.02, utilization: 0.85 },
  { month: 'Jun', efficiency: 1.08, utilization: 0.83 },
];

const teamPerf = [
  { team: 'Engineering', score: 92 },
  { team: 'Design', score: 88 },
  { team: 'Product', score: 85 },
  { team: 'Marketing', score: 79 },
  { team: 'Sales', score: 91 },
];

export default function PerformancePage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'super-admin'], queryFn: () => get<Dash>('/dashboard/super-admin') });
  const k = data?.kpis ?? {};

  return (
    <>
      <PageHeader title="Performance Insights" description="KPIs, trends, and team performance" />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Efficiency" value={k.efficiency != null ? `${(k.efficiency * 100).toFixed(0)}%` : '—'} icon={TrendingUp} loading={isLoading} />
          <Stat label="Utilization" value={k.utilization != null ? `${(k.utilization * 100).toFixed(0)}%` : '—'} icon={Clock} loading={isLoading} />
          <Stat label="Completion rate" value={k.completionRate != null ? `${(k.completionRate * 100).toFixed(0)}%` : '—'} icon={CheckCircle2} loading={isLoading} />
          <Stat label="Delay rate" value={k.delayRate != null ? `${(k.delayRate * 100).toFixed(0)}%` : '—'} icon={Activity} loading={isLoading} />
          <Stat label="Reopen rate" value={k.reopenRate != null ? `${(k.reopenRate * 100).toFixed(0)}%` : '—'} icon={BarChart3} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Efficiency vs. utilization (6 months)</CardTitle></CardHeader>
            <CardBody>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} domain={[0, 1.2]} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="efficiency" stroke="var(--color-brand-600)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="utilization" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Team performance scores</CardTitle></CardHeader>
            <CardBody>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamPerf} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="team" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-fg-muted)' }} width={80} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="score" fill="var(--color-brand-600)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
