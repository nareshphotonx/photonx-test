'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Database, Download, FileJson, ServerCog } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, PageHeader, Skeleton } from '@/components/ui';
import { get, getApiErrorMessage } from '@/lib/api';

type Counts = Record<string, number | undefined>;

const ENDPOINTS = [
  { key: 'tenant',         path: '/tenants/current',     label: 'Tenant' },
  { key: 'users',          path: '/users?limit=100',     label: 'Users' },
  { key: 'teams',          path: '/teams',               label: 'Teams' },
  { key: 'roles',          path: '/roles',               label: 'Roles' },
  { key: 'projects',       path: '/projects?limit=100',  label: 'Projects' },
  { key: 'tasks',          path: '/tasks?limit=100',     label: 'Tasks' },
  { key: 'time_entries',   path: '/time-entries',        label: 'Time entries' },
  { key: 'leave_types',    path: '/leave-types',         label: 'Leave types' },
  { key: 'leave_requests', path: '/leave/requests',      label: 'Leave requests' },
  { key: 'wfh_requests',   path: '/wfh/requests',        label: 'WFH requests' },
  { key: 'holidays',       path: '/holidays',            label: 'Holidays' },
  { key: 'expenses',       path: '/expenses',            label: 'Expenses' },
  { key: 'expense_categories', path: '/expense-categories', label: 'Expense categories' },
  { key: 'office_locations',   path: '/office-locations',  label: 'Office locations' },
  { key: 'office_ips',         path: '/office-ips',        label: 'Office IPs' },
  { key: 'documents',      path: '/documents',           label: 'Knowledge base docs' },
  { key: 'notifications',  path: '/notifications?limit=100', label: 'Notifications' },
  { key: 'whatsapp_messages', path: '/whatsapp/messages?limit=100', label: 'WhatsApp messages' },
];

export default function BackupPage() {
  const [exporting, setExporting] = useState(false);

  // Fetch counts in parallel — gives the user a sense of what's in the workspace
  const counts = useQuery({
    queryKey: ['admin', 'backup', 'counts'],
    queryFn: async () => {
      const out: Counts = {};
      await Promise.all(
        ENDPOINTS.map(async ({ key, path }) => {
          try {
            const data = await get<unknown>(path);
            if (Array.isArray(data)) out[key] = data.length;
            else if (data && typeof data === 'object') {
              const o = data as { total?: number; items?: unknown[] };
              out[key] = o.total ?? (Array.isArray(o.items) ? o.items.length : 1);
            } else {
              out[key] = data == null ? 0 : 1;
            }
          } catch {
            out[key] = undefined;
          }
        }),
      );
      return out;
    },
  });

  const exportSnapshot = async () => {
    setExporting(true);
    try {
      const snapshot: Record<string, unknown> = {
        meta: { exportedAt: new Date().toISOString(), source: 'web-admin' },
      };
      for (const { key, path } of ENDPOINTS) {
        try {
          snapshot[key] = await get<unknown>(path);
        } catch (e) {
          snapshot[key] = { __error: getApiErrorMessage(e) };
        }
      }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photonx-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Snapshot downloaded');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const totalCount = counts.data ? Object.values(counts.data).reduce<number>((s, n) => s + (n ?? 0), 0) : 0;

  return (
    <>
      <PageHeader title="Backup & export" description="Download a JSON snapshot of your workspace, or trigger the server-side backup script." />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Workspace snapshot</CardTitle>
              <Badge tone="primary">{totalCount} records</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-[color:var(--color-fg-muted)]">
              One-click export bundles every list endpoint into a single JSON file you can save offline, share with auditors, or restore from.
            </p>

            {counts.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                {ENDPOINTS.map(({ key, label }) => {
                  const n = counts.data?.[key];
                  return (
                    <div key={key} className="flex items-center justify-between px-3 py-2 rounded-md bg-[color:var(--color-surface-2)]">
                      <span className="text-[color:var(--color-fg-muted)]">{label}</span>
                      <span className="tabular-nums font-semibold">{n ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={exportSnapshot} loading={exporting}>
                <Download className="h-4 w-4" /> Download JSON snapshot
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Server-side backup</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-[color:var(--color-fg-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Database backup</p>
                <p className="text-[color:var(--color-fg-muted)]">
                  Run from the API host (or your scheduled cron):
                </p>
                <pre className="mt-2 p-3 bg-[color:var(--color-surface-2)] rounded-lg text-xs overflow-x-auto font-mono">
mysqldump -h localhost -P 4406 -u photonx -p photonx_workos &gt; backup-$(date +%F).sql
                </pre>
              </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t border-[color:var(--color-border)]">
              <FileJson className="h-5 w-5 text-[color:var(--color-fg-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Restore</p>
                <p className="text-[color:var(--color-fg-muted)]">Pipe a SQL dump back into the same MySQL instance:</p>
                <pre className="mt-2 p-3 bg-[color:var(--color-surface-2)] rounded-lg text-xs overflow-x-auto font-mono">
mysql -h localhost -P 4406 -u photonx -p photonx_workos &lt; backup-2026-05-02.sql
                </pre>
              </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t border-[color:var(--color-border)]">
              <ServerCog className="h-5 w-5 text-[color:var(--color-fg-muted)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Schedule</p>
                <p className="text-[color:var(--color-fg-muted)]">For production, add to your host&apos;s crontab (daily at 2am):</p>
                <pre className="mt-2 p-3 bg-[color:var(--color-surface-2)] rounded-lg text-xs overflow-x-auto font-mono">
0 2 * * * /usr/bin/mysqldump ... &gt; /backups/photonx-$(date +\%F).sql
                </pre>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
