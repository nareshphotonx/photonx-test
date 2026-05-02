'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Home, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton,
  TBody, TD, TH, THead, TR, Table, Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Balance = { balance?: number; remaining?: number; used?: number };
type Req = { id: string; requestDate?: string; status?: string; reason?: string };

const schema = z.object({
  requestDate: z.string().min(1, 'Date required'),
  reason: z.string().min(3, 'Reason is required'),
});
type FormValues = z.infer<typeof schema>;

export default function WfhPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const balance = useQuery({ queryKey: ['wfh', 'balance', 'me'], queryFn: () => get<Balance>('/wfh/balance/me') });
  const reqs = useQuery({ queryKey: ['wfh', 'requests'], queryFn: () => get<{ items?: Req[] } | Req[]>('/wfh/requests') });
  const items = Array.isArray(reqs.data) ? reqs.data : reqs.data?.items ?? [];

  return (
    <>
      <PageHeader title="Work from home" description="Your WFH balance and requests" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Apply for WFH</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] flex items-center justify-center">
              <Home className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Available</p>
              {balance.isLoading ? (
                <Skeleton className="h-8 w-20 mt-1" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">
                  {balance.data?.balance ?? balance.data?.remaining ?? 0} <span className="text-sm font-normal text-[color:var(--color-fg-muted)]">days remaining</span>
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
          <CardBody className="p-0">
            {reqs.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : items.length === 0 ? (
              <EmptyState icon={Home} title="No WFH requests yet" description="Request to work from home for any date." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Apply for WFH</Button>} />
            ) : (
              <Table>
                <THead><TR><TH>Date</TH><TH>Reason</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {items.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">{r.requestDate ? new Date(r.requestDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)] max-w-md truncate">{r.reason ?? '—'}</TD>
                      <TD><Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status ?? 'PENDING'}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <ApplyDialog open={open} onOpenChange={setOpen} onCreated={() => { qc.invalidateQueries({ queryKey: ['wfh'] }); setOpen(false); }} />
    </>
  );
}

function ApplyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/wfh/requests', { requestDate: new Date(v.requestDate).toISOString(), reason: v.reason }),
    onSuccess: () => { toast.success('WFH request submitted'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Apply for work from home" />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="requestDate" required>Date</Label>
              <Input id="requestDate" type="date" {...register('requestDate')} />
              <FieldError>{errors.requestDate?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="reason" required>Reason</Label>
              <Textarea id="reason" {...register('reason')} placeholder="Briefly explain why you need to work from home…" />
              <FieldError>{errors.reason?.message}</FieldError>
            </div>
            <p className="text-xs text-[color:var(--color-fg-muted)]">💡 Tip: send <span className="font-mono bg-[color:var(--color-surface-2)] px-1 rounded">apply wfh today internet issue</span> on WhatsApp.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Submit request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
