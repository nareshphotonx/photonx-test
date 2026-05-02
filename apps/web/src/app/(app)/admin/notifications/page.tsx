'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Send } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  EmptyState, Input, Label, PageHeader, Select, Skeleton, TabsContent, TabsList, TabsRoot, TabsTrigger, Textarea,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type UserRow = { id: string; fullName?: string; name?: string; email?: string };
type NotificationRow = { id: string; title?: string; body?: string; eventType?: string; channel?: string; isRead?: boolean; createdAt?: string };

const CHANNELS = ['IN_APP', 'EMAIL', 'WHATSAPP'];

export default function NotificationsAdminPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Send a one-off notification or inspect the recent stream." />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <TabsRoot defaultValue="send">
          <TabsList>
            <TabsTrigger value="send">Send</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>
          <TabsContent value="send"><SendTab /></TabsContent>
          <TabsContent value="recent"><RecentTab /></TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}

function SendTab() {
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: UserRow[] }>('/users', { limit: 100 }) });

  const [title, setTitle] = useState('Test notification');
  const [body, setBody] = useState('This is a test from the admin console.');
  const [eventType, setEventType] = useState('ADMIN_TEST');
  const [targetUserId, setTargetUserId] = useState('');
  const [channels, setChannels] = useState<Set<string>>(new Set(['IN_APP']));

  const send = useMutation({
    mutationFn: () => post('/notifications/send', {
      eventKey: `admin-test-${Date.now()}`,
      eventType,
      title,
      body,
      targetUserIds: [targetUserId],
      channels: Array.from(channels),
      payload: { source: 'web-admin', sentAt: new Date().toISOString() },
    }),
    onSuccess: () => toast.success('Notification queued'),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const toggleChannel = (c: string) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Send a notification</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="recipient" required>Recipient</Label>
            <Select id="recipient" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
              <option value="">Select user…</option>
              {(users.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="event-type" required>Event type</Label>
            <Input id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="ADMIN_TEST" className="font-mono" />
          </div>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="body">Body</Label>
          <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <Label>Channels</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const active = channels.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors ${active ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]' : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]'}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!targetUserId || channels.size === 0 || !eventType.trim()}>
            <Send className="h-4 w-4" /> Send notification
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function RecentTab() {
  const list = useQuery({ queryKey: ['notifications', 'admin'], queryFn: () => get<{ items?: NotificationRow[] } | NotificationRow[]>('/notifications', { limit: 50 }) });
  const items = Array.isArray(list.data) ? list.data : list.data?.items ?? [];
  return (
    <Card>
      <CardHeader><CardTitle>Recent notifications</CardTitle></CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" />
        ) : (
          <Table>
            <THead><TR><TH>Time</TH><TH>Event</TH><TH>Channel</TH><TH>Title / Body</TH><TH>Read</TH></TR></THead>
            <TBody>
              {items.map((n) => (
                <TR key={n.id}>
                  <TD className="text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap">{n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</TD>
                  <TD><Badge tone="info" size="sm">{n.eventType ?? '—'}</Badge></TD>
                  <TD><Badge tone="neutral" size="sm">{n.channel ?? '—'}</Badge></TD>
                  <TD>
                    <p className="text-sm font-medium">{n.title ?? '—'}</p>
                    {n.body && <p className="text-xs text-[color:var(--color-fg-muted)] truncate max-w-md">{n.body}</p>}
                  </TD>
                  <TD>{n.isRead ? <Badge tone="success" size="sm">Read</Badge> : <Badge tone="primary" size="sm" dot>Unread</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
