'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarOff, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Holiday = { id: string; name: string; date: string; isOptional?: boolean };

const schema = z.object({
  name: z.string().min(2),
  date: z.string().min(1),
  isOptional: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function HolidaysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['holidays'], queryFn: () => get<{ items?: Holiday[] } | Holiday[]>('/holidays') });
  const items = (Array.isArray(data) ? data : data?.items ?? []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/holidays', { name: v.name, date: new Date(v.date).toISOString(), isOptional: v.isOptional ?? false, isActive: true }),
    onSuccess: () => { toast.success('Holiday added'); reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['holidays'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Holidays" description="Your workspace holiday calendar" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add holiday</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
          : items.length === 0 ? <EmptyState icon={CalendarOff} title="No holidays defined" description="Add public and optional holidays so they show in calendars." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add holiday</Button>} />
          : (
            <Card><CardBody className="p-0">
              <Table>
                <THead><TR><TH>Date</TH><TH>Holiday</TH><TH>Type</TH></TR></THead>
                <TBody>
                  {items.map((h) => (
                    <TR key={h.id}>
                      <TD className="font-medium">{new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</TD>
                      <TD>{h.name}</TD>
                      <TD><Badge tone={h.isOptional ? 'info' : 'primary'}>{h.isOptional ? 'Optional' : 'Public'}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody></Card>
          )}
      </div>

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="Add holiday" />
          <form onSubmit={handleSubmit((v) => create.mutate(v))}>
            <DialogBody className="space-y-4">
              <div><Label htmlFor="name" required>Name</Label><Input id="name" {...register('name')} placeholder="Independence Day" /><FieldError>{errors.name?.message}</FieldError></div>
              <div><Label htmlFor="date" required>Date</Label><Input id="date" type="date" {...register('date')} /><FieldError>{errors.date?.message}</FieldError></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isOptional')} className="h-4 w-4 accent-[color:var(--color-primary)]" /> Optional (employees can choose to claim)</label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add holiday</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
