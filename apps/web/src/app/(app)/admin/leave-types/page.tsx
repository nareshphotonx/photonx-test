'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, Plus, Settings, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Select, Skeleton, Textarea,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type LeaveType = { id: string; code: string; name: string; description?: string; isActive?: boolean };
type UserOpt = { id: string; name?: string; fullName?: string; email?: string };
type Override = { userId: string; annualQuota: number; monthlyAccrual?: number };
const schema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/i, 'Letters, numbers, _'),
  name: z.string().min(2),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPolicyType, setEditingPolicyType] = useState<LeaveType | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['leave-types'], queryFn: () => get<{ items?: LeaveType[] } | LeaveType[]>('/leave-types') });
  const items = Array.isArray(data) ? data : data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/leave-types', { ...v, isActive: true }),
    onSuccess: () => { toast.success('Leave type added'); reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['leave-types'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Leave types" description="Categories like Casual, Sick, Earned. Used by employees when applying for leave." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add leave type</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
          : items.length === 0 ? <EmptyState icon={CalendarDays} title="No leave types" description="Add at least one before employees can apply for leave." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add leave type</Button>} />
          : (
            <Card><CardBody className="p-0">
              <Table>
                <THead><TR><TH>Code</TH><TH>Name</TH><TH>Description</TH><TH>Status</TH><TH align="right">Quota / Overrides</TH></TR></THead>
                <TBody>
                  {items.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-mono text-xs">{t.code}</TD>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{t.description ?? '—'}</TD>
                      <TD><Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></TD>
                      <TD align="right">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPolicyType(t)}>
                          <Settings className="h-3.5 w-3.5" /> Set quota
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody></Card>
          )}
      </div>

      {editingPolicyType && (
        <PolicyDialog
          leaveType={editingPolicyType}
          onClose={() => setEditingPolicyType(null)}
          onSaved={() => setEditingPolicyType(null)}
        />
      )}

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="Add leave type" />
          <form onSubmit={handleSubmit((v) => create.mutate(v))}>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="code" required>Code</Label><Input id="code" className="font-mono uppercase" {...register('code')} placeholder="CASUAL" /><FieldError>{errors.code?.message}</FieldError></div>
                <div><Label htmlFor="name" required>Display name</Label><Input id="name" {...register('name')} placeholder="Casual leave" /><FieldError>{errors.name?.message}</FieldError></div>
              </div>
              <div><Label htmlFor="description">Description</Label><Textarea id="description" {...register('description')} placeholder="When to use this leave type…" /></div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function PolicyDialog({ leaveType, onClose, onSaved }: { leaveType: LeaveType; onClose: () => void; onSaved: () => void }) {
  const [defaultAnnualQuota, setDefaultAnnualQuota] = useState('12');
  const [monthlyAccrual, setMonthlyAccrual] = useState('1');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [pickUserId, setPickUserId] = useState('');
  const [pickQuota, setPickQuota] = useState('15');

  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: UserOpt[] }>('/users', { limit: 100 }) });
  const userMap = new Map((users.data?.items ?? []).map((u) => [u.id, u] as const));

  const create = useMutation({
    mutationFn: () => post('/leave-policies', {
      leaveTypeId: leaveType.id,
      defaultAnnualQuota: Number(defaultAnnualQuota),
      monthlyAccrual: Number(monthlyAccrual),
      joiningProration: true,
      userOverrides: overrides,
    }),
    onSuccess: () => { toast.success(`Policy saved for ${leaveType.name}`); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const addOverride = () => {
    if (!pickUserId || overrides.some((o) => o.userId === pickUserId)) return;
    const q = Number(pickQuota);
    if (!q || q < 0) return;
    setOverrides((prev) => [...prev, { userId: pickUserId, annualQuota: q }]);
    setPickUserId('');
    setPickQuota('15');
  };

  const candidates = (users.data?.items ?? []).filter((u) => !overrides.some((o) => o.userId === u.id));

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader title={`Quota policy · ${leaveType.name}`} description="Default for everyone, with per-user overrides for exceptions." />
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="def-quota" required>Default annual quota (days)</Label>
              <Input id="def-quota" type="number" step="0.5" min="0" value={defaultAnnualQuota} onChange={(e) => setDefaultAnnualQuota(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="accrual" required>Monthly accrual</Label>
              <Input id="accrual" type="number" step="0.25" min="0" value={monthlyAccrual} onChange={(e) => setMonthlyAccrual(e.target.value)} />
              <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-1">Days credited per month</p>
            </div>
          </div>

          <div className="border-t border-[color:var(--color-border)] pt-4">
            <Label>Per-user overrides ({overrides.length})</Label>
            <p className="text-xs text-[color:var(--color-fg-muted)] mb-2">Give specific people a different quota — useful for new joiners, contractors, or special grants.</p>
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 mb-3">
              <Select value={pickUserId} onChange={(e) => setPickUserId(e.target.value)}>
                <option value="">Select user…</option>
                {candidates.map((u) => (<option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>))}
              </Select>
              <Input type="number" step="0.5" min="0" value={pickQuota} onChange={(e) => setPickQuota(e.target.value)} placeholder="Days" />
              <Button type="button" variant="secondary" size="md" onClick={addOverride} disabled={!pickUserId}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {overrides.length > 0 && (
              <ul className="divide-y divide-[color:var(--color-border)] border border-[color:var(--color-border)] rounded-lg overflow-hidden">
                {overrides.map((o) => {
                  const u = userMap.get(o.userId);
                  return (
                    <li key={o.userId} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--color-surface)]">
                      <span className="flex-1 text-sm font-medium">{u?.fullName ?? u?.name ?? u?.email ?? o.userId}</span>
                      <span className="font-mono tabular-nums text-sm">{o.annualQuota} days</span>
                      <button
                        type="button"
                        onClick={() => setOverrides((prev) => prev.filter((x) => x.userId !== o.userId))}
                        className="h-7 w-7 inline-flex items-center justify-center rounded text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} loading={create.isPending}>Save policy</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
