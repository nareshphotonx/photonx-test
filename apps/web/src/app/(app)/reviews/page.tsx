'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, TabsContent, TabsList, TabsRoot, TabsTrigger, TBody, TD, TH, THead, TR, Table } from '@/components/ui';
import { get } from '@/lib/api';

type Cycle = { id: string; name?: string; periodStart?: string; periodEnd?: string; status?: string; entryCount?: number };
type Entry = { id: string; cycleId?: string; reviewee?: { name?: string; email?: string }; reviewer?: { name?: string; email?: string }; status?: string; rating?: number };

export default function ReviewsPage() {
  const cycles = useQuery({ queryKey: ['review-cycles'], queryFn: () => get<{ items?: Cycle[] } | Cycle[]>('/review-cycles') });
  const entries = useQuery({ queryKey: ['reviews'], queryFn: () => get<{ items?: Entry[] } | Entry[]>('/reviews') });

  const cycleItems = Array.isArray(cycles.data) ? cycles.data : cycles.data?.items ?? [];
  const entryItems = Array.isArray(entries.data) ? entries.data : entries.data?.items ?? [];

  return (
    <>
      <PageHeader title="Performance Reviews" description="Cycles and individual reviews" actions={<Button><Plus className="h-4 w-4" /> New cycle</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <TabsRoot defaultValue="cycles">
          <TabsList>
            <TabsTrigger value="cycles">Cycles ({cycleItems.length})</TabsTrigger>
            <TabsTrigger value="entries">My reviews ({entryItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="cycles">
            {cycles.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            ) : cycleItems.length === 0 ? (
              <EmptyState icon={Star} title="No review cycles yet" description="Start a review cycle to collect feedback across the team." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycleItems.map((c) => (
                  <Card key={c.id}>
                    <CardBody>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{c.name ?? 'Cycle'}</p>
                          <p className="text-xs text-[color:var(--color-fg-muted)] mt-0.5">
                            {c.periodStart && new Date(c.periodStart).toLocaleDateString()}
                            {c.periodEnd && ` → ${new Date(c.periodEnd).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge tone={c.status === 'ACTIVE' ? 'primary' : c.status === 'COMPLETED' ? 'success' : 'neutral'}>{c.status ?? 'DRAFT'}</Badge>
                      </div>
                      <p className="text-xs text-[color:var(--color-fg-muted)]">{c.entryCount ?? 0} review entries</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="entries">
            {entries.isLoading ? (
              <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
            ) : entryItems.length === 0 ? (
              <EmptyState icon={Star} title="No reviews yet" />
            ) : (
              <Card>
                <CardBody className="p-0">
                  <Table>
                    <THead><TR><TH>Reviewee</TH><TH>Reviewer</TH><TH>Rating</TH><TH>Status</TH></TR></THead>
                    <TBody>
                      {entryItems.map((e) => (
                        <TR key={e.id}>
                          <TD className="font-medium">{e.reviewee?.name ?? e.reviewee?.email ?? '—'}</TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)]">{e.reviewer?.name ?? e.reviewer?.email ?? '—'}</TD>
                          <TD>{e.rating != null ? <span className="font-semibold tabular-nums">{e.rating.toFixed(1)} / 5</span> : '—'}</TD>
                          <TD><Badge tone={e.status === 'SUBMITTED' ? 'success' : e.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>{e.status ?? 'DRAFT'}</Badge></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}
