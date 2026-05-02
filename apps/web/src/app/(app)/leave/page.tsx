'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  EmptyState,
  FieldError,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type LeaveType = { id: string; name: string };
type Balance = { leaveTypeId?: string; leaveTypeName?: string; balance?: number; used?: number };
type Request = { id: string; startDate: string; endDate: string; status: string; reason?: string; leaveType?: { name?: string }; totalDays?: number };

const schema = z.object({
  leaveTypeId: z.string().min(1, 'Pick a leave type'),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(3),
});
type FormValues = z.infer<typeof schema>;

export default function LeavePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const balance = useQuery({ queryKey: ['leave', 'balance', 'me'], queryFn: () => get<Balance[] | { items?: Balance[] }>('/leave/balance/me') });
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: () => get<LeaveType[] | { items?: LeaveType[] }>('/leave-types') });
  const requests = useQuery({ queryKey: ['leave', 'requests'], queryFn: () => get<{ items?: Request[] } | Request[]>('/leave/requests') });

  const balances = Array.isArray(balance.data) ? balance.data : balance.data?.items ?? [];
  const typeList = Array.isArray(types.data) ? types.data : types.data?.items ?? [];
  const requestList = Array.isArray(requests.data) ? requests.data : requests.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Leave"
        description="Your balances and time-off requests"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Apply for leave</Button>}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wider mb-3">Balances</h2>
          {balance.isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
            </div>
          ) : balances.length === 0 ? (
            <Card><CardBody><EmptyState icon={CalendarDays} title="No leave types configured" /></CardBody></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {balances.map((b, i) => (
                <Card key={i}>
                  <CardBody>
                    <p className="text-xs text-[color:var(--color-fg-muted)] truncate uppercase tracking-wider font-semibold">{b.leaveTypeName ?? 'Leave'}</p>
                    <p className="text-3xl font-semibold tabular-nums mt-2">{b.balance ?? 0}</p>
                    <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">days remaining{b.used !== undefined && ` · ${b.used} used`}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
          <CardBody className="p-0">
            {requests.isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : requestList.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No leave requests" description="Apply for time off to see it here." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Apply for leave</Button>} />
            ) : (
              <Table>
                <THead><TR><TH>Type</TH><TH>Dates</TH><TH>Days</TH><TH>Reason</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {requestList.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">{r.leaveType?.name ?? 'Leave'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}</TD>
                      <TD className="tabular-nums">{r.totalDays ?? '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)] max-w-xs truncate">{r.reason ?? '—'}</TD>
                      <TD><Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>{r.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <ApplyDialog open={open} onOpenChange={setOpen} types={typeList} onCreated={() => { qc.invalidateQueries({ queryKey: ['leave'] }); setOpen(false); }} />
    </>
  );
}

function ApplyDialog({ open, onOpenChange, types, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; types: LeaveType[]; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/leave/requests', { ...v, startDate: new Date(v.startDate).toISOString(), endDate: new Date(v.endDate).toISOString() }),
    onSuccess: () => { toast.success('Leave request submitted'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Apply for leave" />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="leaveTypeId" required>Leave type</Label>
              <Select id="leaveTypeId" {...register('leaveTypeId')}>
                <option value="">Select…</option>
                {types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </Select>
              <FieldError>{errors.leaveTypeId?.message}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="startDate" required>Start</Label><Input id="startDate" type="date" {...register('startDate')} /><FieldError>{errors.startDate?.message}</FieldError></div>
              <div><Label htmlFor="endDate" required>End</Label><Input id="endDate" type="date" {...register('endDate')} /><FieldError>{errors.endDate?.message}</FieldError></div>
            </div>
            <div><Label htmlFor="reason" required>Reason</Label><Textarea id="reason" {...register('reason')} placeholder="Briefly explain…" /><FieldError>{errors.reason?.message}</FieldError></div>
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
