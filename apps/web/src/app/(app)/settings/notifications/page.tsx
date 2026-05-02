'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';

type Pref = { eventType?: string; channels?: Record<string, boolean> };

export default function NotificationsSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences', 'me'],
    queryFn: () => get<{ preferences?: Pref[] } | Pref[]>('/notification-preferences/me'),
  });
  const prefs = Array.isArray(data) ? data : data?.preferences ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader>
      <CardBody>
        {isLoading ? <Skeleton className="h-32" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-muted)] border-b border-[color:var(--color-border)]">
                <tr><th className="text-left py-2 font-semibold">Event</th><th className="px-3 py-2 font-semibold">In-app</th><th className="px-3 py-2 font-semibold">Email</th><th className="px-3 py-2 font-semibold">WhatsApp</th></tr>
              </thead>
              <tbody>
                {prefs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-[color:var(--color-fg-muted)]">No preferences configured. Defaults apply.</td></tr>
                ) : prefs.map((p, i) => (
                  <tr key={i} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="py-2.5 font-medium">{p.eventType ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center"><input type="checkbox" defaultChecked={p.channels?.IN_APP} className="h-4 w-4 accent-[color:var(--color-primary)]" /></td>
                    <td className="px-3 py-2.5 text-center"><input type="checkbox" defaultChecked={p.channels?.EMAIL} className="h-4 w-4 accent-[color:var(--color-primary)]" /></td>
                    <td className="px-3 py-2.5 text-center"><input type="checkbox" defaultChecked={p.channels?.WHATSAPP} className="h-4 w-4 accent-[color:var(--color-primary)]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
