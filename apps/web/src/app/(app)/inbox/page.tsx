'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Check } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';
import { cn } from '@/lib/cn';

type Notification = {
  id: string;
  title?: string;
  body?: string;
  message?: string;
  eventType?: string;
  channel?: string;
  isRead?: boolean;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export default function InboxPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items?: Notification[] } | Notification[]>('/notifications', { limit: 50 }) });
  const items = Array.isArray(data) ? data : data?.items ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: (id: string) => post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Inbox"
        description={isLoading ? 'Loading…' : unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'All caught up'}
      />
      <div className="max-w-3xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="You'll be notified here when things change in your workspace." />
        ) : (
          <Card><CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border)]">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex gap-3 p-4 transition-colors',
                    !n.isRead && 'bg-[color:var(--color-primary-soft)]/30',
                  )}
                >
                  <div className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    !n.isRead ? 'bg-[color:var(--color-primary)] text-white' : 'bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)]',
                  )}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.eventType && <Badge tone="neutral" size="sm">{n.eventType}</Badge>}
                      {n.channel && <Badge tone="info" size="sm">{n.channel}</Badge>}
                      {!n.isRead && <Badge tone="primary" size="sm" dot>New</Badge>}
                    </div>
                    <p className="text-sm font-medium">{n.title ?? n.eventType ?? 'Notification'}</p>
                    <p className="text-sm text-[color:var(--color-fg-muted)] mt-0.5">{n.body ?? n.message ?? ''}</p>
                    <p className="text-[11px] text-[color:var(--color-fg-subtle)] mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                  </div>
                  {!n.isRead && (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                      <Check className="h-3.5 w-3.5" /> Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody></Card>
        )}
      </div>
    </>
  );
}
