'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search } from 'lucide-react';
import {
  Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Input, PageHeader, Skeleton,
  TabsContent, TabsList, TabsRoot, TabsTrigger,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get } from '@/lib/api';

type Message = {
  id: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  fromPhone?: string;
  toPhone?: string;
  body?: string;
  templateName?: string;
  status?: string;
  createdAt?: string;
};

type Session = {
  id: string;
  userPhone?: string;
  userId?: string;
  state?: string;
  expiresAt?: string;
  createdAt?: string;
};

export default function WhatsAppAdminPage() {
  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="See every message coming in and going out. Verify your bot is working."
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card className="mb-4 bg-gradient-to-br from-[color:var(--color-brand-50)] to-white border-[color:var(--color-brand-200)]">
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[color:var(--color-primary)] text-white flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Available commands</p>
                <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">
                  <span className="font-mono bg-white px-1 rounded">in</span> ·
                  <span className="font-mono bg-white px-1 rounded mx-1">out</span> ·
                  <span className="font-mono bg-white px-1 rounded">tasks</span> ·
                  <span className="font-mono bg-white px-1 rounded mx-1">start T-101</span> ·
                  <span className="font-mono bg-white px-1 rounded">done T-101</span> ·
                  <span className="font-mono bg-white px-1 rounded mx-1">log 2h T-101</span> ·
                  <span className="font-mono bg-white px-1 rounded">apply leave tomorrow sick</span> ·
                  <span className="font-mono bg-white px-1 rounded mx-1">apply wfh today</span> ·
                  <span className="font-mono bg-white px-1 rounded">expense 450 travel</span> ·
                  <span className="font-mono bg-white px-1 rounded mx-1">my performance</span>
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <TabsRoot defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
          <TabsContent value="messages"><MessagesTab /></TabsContent>
          <TabsContent value="sessions"><SessionsTab /></TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}

function MessagesTab() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['whatsapp', 'messages'], queryFn: () => get<{ items?: Message[] } | Message[]>('/whatsapp/messages', { limit: 100 }) });
  const items = (Array.isArray(data) ? data : data?.items ?? []).filter((m) => !search || `${m.body ?? ''} ${m.fromPhone ?? ''} ${m.toPhone ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Recent messages</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8" />
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {isLoading ? <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          : items.length === 0 ? <EmptyState icon={MessageSquare} title="No messages yet" description="Send a message from WhatsApp to your bot to see it here." />
          : (
            <Table>
              <THead><TR><TH>Time</TH><TH>Direction</TH><TH>From</TH><TH>To</TH><TH>Message</TH><TH>Status</TH></TR></THead>
              <TBody>
                {items.map((m) => (
                  <TR key={m.id}>
                    <TD className="text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</TD>
                    <TD><Badge tone={m.direction === 'INBOUND' ? 'info' : 'primary'} size="sm">{m.direction ?? '—'}</Badge></TD>
                    <TD className="font-mono text-xs">{m.fromPhone ?? '—'}</TD>
                    <TD className="font-mono text-xs">{m.toPhone ?? '—'}</TD>
                    <TD className="text-sm max-w-xs truncate">{m.body ?? m.templateName ?? '—'}</TD>
                    <TD>{m.status && <Badge tone="neutral" size="sm">{m.status}</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
      </CardBody>
    </Card>
  );
}

function SessionsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['whatsapp', 'sessions'], queryFn: () => get<{ items?: Session[] } | Session[]>('/whatsapp/sessions') });
  const items = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Active sessions</CardTitle></CardHeader>
      <CardBody className="p-0">
        {isLoading ? <div className="p-5 space-y-2"><Skeleton className="h-12" /></div>
          : items.length === 0 ? <EmptyState icon={MessageSquare} title="No active sessions" description="Sessions are created when an employee starts a multi-step flow (like applying leave) on WhatsApp." />
          : (
            <Table>
              <THead><TR><TH>User</TH><TH>State</TH><TH>Expires</TH><TH>Started</TH></TR></THead>
              <TBody>
                {items.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-xs">{s.userPhone ?? s.userId ?? '—'}</TD>
                    <TD><Badge tone="info">{s.state ?? '—'}</Badge></TD>
                    <TD className="text-xs text-[color:var(--color-fg-muted)]">{s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '—'}</TD>
                    <TD className="text-xs text-[color:var(--color-fg-muted)]">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
      </CardBody>
    </Card>
  );
}
