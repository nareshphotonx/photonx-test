'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, CheckCircle2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  EmptyState,
  Label,
  PageHeader,
  Skeleton,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Item = {
  id: string;
  entityType?: string;
  entityId?: string;
  requesterName?: string;
  requesterEmail?: string;
  createdAt?: string;
  status?: string;
  summary?: string;
  reason?: string;
};

type ActionKind = 'approve' | 'reject';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [acting, setActing] = useState<{ item: Item; kind: ActionKind } | null>(null);

  const pending = useQuery({ queryKey: ['approvals', 'pending'], queryFn: () => get<{ items?: Item[] } | Item[]>('/approvals/pending') });
  const history = useQuery({ queryKey: ['approvals', 'history'], queryFn: () => get<{ items?: Item[] } | Item[]>('/approvals/history') });

  const pItems = Array.isArray(pending.data) ? pending.data : pending.data?.items ?? [];
  const hItems = Array.isArray(history.data) ? history.data : history.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review and act on requests from your team"
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <TabsRoot defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pItems.length})</TabsTrigger>
            <TabsTrigger value="history">History ({hItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            {pending.isLoading ? (
              <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
            ) : pItems.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All caught up" description="No pending approvals right now." />
            ) : (
              <Card>
                <CardBody className="p-0">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Type</TH>
                        <TH>Requester</TH>
                        <TH>Summary</TH>
                        <TH>Submitted</TH>
                        <TH align="right">Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {pItems.map((a) => (
                        <TR key={a.id}>
                          <TD><Badge tone="info">{a.entityType ?? 'REQUEST'}</Badge></TD>
                          <TD className="font-medium">{a.requesterName ?? a.requesterEmail ?? '—'}</TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)] max-w-md truncate">{a.summary ?? a.reason ?? '—'}</TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)]">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant="secondary" onClick={() => setActing({ item: a, kind: 'reject' })}>
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                              <Button size="sm" onClick={() => setActing({ item: a, kind: 'approve' })}>
                                <Check className="h-3.5 w-3.5" /> Approve
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            {history.isLoading ? (
              <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
            ) : hItems.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No history" />
            ) : (
              <Card>
                <CardBody className="p-0">
                  <Table>
                    <THead><TR><TH>Type</TH><TH>Requester</TH><TH>Summary</TH><TH>Submitted</TH><TH>Status</TH></TR></THead>
                    <TBody>
                      {hItems.map((a) => (
                        <TR key={a.id}>
                          <TD><Badge tone="info">{a.entityType ?? '—'}</Badge></TD>
                          <TD className="font-medium">{a.requesterName ?? a.requesterEmail ?? '—'}</TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)] max-w-md truncate">{a.summary ?? '—'}</TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)]">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</TD>
                          <TD><Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'warning'}>{a.status ?? 'PENDING'}</Badge></TD>
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

      {acting && (
        <ActionDialog
          item={acting.item}
          kind={acting.kind}
          onClose={() => setActing(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['approvals'] });
            setActing(null);
          }}
        />
      )}
    </>
  );
}

function ActionDialog({ item, kind, onClose, onDone }: { item: Item; kind: ActionKind; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');

  const action = useMutation({
    mutationFn: () => {
      const body = reason ? { reason } : {};
      const base = endpointFor(item, kind);
      return post(base, body);
    },
    onSuccess: () => {
      toast.success(kind === 'approve' ? 'Request approved' : 'Request rejected');
      onDone();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader
          title={kind === 'approve' ? 'Approve request' : 'Reject request'}
          description={`${item.entityType ?? 'Request'} from ${item.requesterName ?? item.requesterEmail ?? 'unknown'}`}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate();
          }}
        >
          <DialogBody className="space-y-3">
            {item.summary && (
              <div className="p-3 bg-[color:var(--color-surface-2)] rounded-lg text-sm text-[color:var(--color-fg-muted)]">
                {item.summary}
              </div>
            )}
            <div>
              <Label htmlFor="reason">{kind === 'reject' ? 'Reason for rejection' : 'Note (optional)'}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={kind === 'reject' ? 'Why is this being rejected?' : 'Optional context for the team…'}
                required={kind === 'reject'}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant={kind === 'approve' ? 'primary' : 'danger'}
              loading={action.isPending}
            >
              {kind === 'approve' ? <><Check className="h-4 w-4" />Approve</> : <><X className="h-4 w-4" />Reject</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function endpointFor(item: Item, kind: ActionKind): string {
  // Route to type-specific approval endpoints when entityType tells us the source.
  const t = (item.entityType ?? '').toUpperCase();
  if (t.includes('LEAVE')) return `/leave/requests/${item.entityId ?? item.id}/${kind}`;
  if (t.includes('EXPENSE')) return `/expenses/${item.entityId ?? item.id}/${kind}`;
  if (t.includes('REGULARIZATION')) return `/attendance/regularization/${item.entityId ?? item.id}/${kind}`;
  // Generic approvals fallback.
  return `/approvals/${item.id}/${kind}`;
}
