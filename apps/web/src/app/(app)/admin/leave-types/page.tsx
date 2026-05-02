'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton, Textarea,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type LeaveType = { id: string; code: string; name: string; description?: string; isActive?: boolean };
const schema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/i, 'Letters, numbers, _'),
  name: z.string().min(2),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
                <THead><TR><TH>Code</TH><TH>Name</TH><TH>Description</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {items.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-mono text-xs">{t.code}</TD>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{t.description ?? '—'}</TD>
                      <TD><Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody></Card>
          )}
      </div>

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
