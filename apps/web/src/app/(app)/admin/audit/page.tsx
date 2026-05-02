'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Search } from 'lucide-react';
import {
  Badge, Card, CardBody, EmptyState, Input, PageHeader, Skeleton,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get } from '@/lib/api';

type AuditEvent = {
  id: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  source?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  // Try a few likely endpoints — the API may expose audit under /audit-logs or via notifications stream.
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      try {
        return await get<{ items?: AuditEvent[] } | AuditEvent[]>('/audit-logs');
      } catch {
        try {
          return await get<{ items?: AuditEvent[] } | AuditEvent[]>('/audit/logs');
        } catch {
          return [] as AuditEvent[];
        }
      }
    },
  });
  const items = (Array.isArray(data) ? data : data?.items ?? []).filter((e) =>
    !search || `${e.action ?? ''} ${e.entityType ?? ''} ${e.actorName ?? e.actorEmail ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Audit log" description="Every change in your workspace, with who did it and what changed." />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, entity, actor…" className="pl-8" />
        </div>

        {isLoading ? <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
          : items.length === 0 ? <EmptyState icon={History} title="No audit events yet" description="As your team works, every create / update / delete will appear here." />
          : (
            <Card><CardBody className="p-0">
              <Table>
                <THead><TR><TH>Time</TH><TH>Actor</TH><TH>Action</TH><TH>Entity</TH><TH>Source</TH></TR></THead>
                <TBody>
                  {items.map((e) => (
                    <TR key={e.id}>
                      <TD className="text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap">{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</TD>
                      <TD className="font-medium">{e.actorName ?? e.actorEmail ?? <span className="text-[color:var(--color-fg-muted)] font-normal">system</span>}</TD>
                      <TD><Badge tone="info">{e.action ?? '—'}</Badge></TD>
                      <TD className="font-mono text-xs text-[color:var(--color-fg-muted)]">{e.entityType ?? '—'}{e.entityId ? `:${e.entityId.slice(0, 8)}` : ''}</TD>
                      <TD>{e.source && <Badge tone="neutral" size="sm">{e.source}</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody></Card>
          )}
      </div>
    </>
  );
}
