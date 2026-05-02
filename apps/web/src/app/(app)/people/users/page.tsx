'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Search, UserPlus, Users } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type User = {
  id: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
  roles?: Array<{ name?: string } | string>;
  createdAt?: string;
};

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  phone: z.string().optional(),
  password: z.string().min(8, 'Min 8 characters'),
}).refine((d) => d.email || d.phone, { message: 'Provide either email or phone', path: ['email'] });
type FormValues = z.infer<typeof schema>;

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => get<{ items: User[]; total: number }>('/users', { limit: 100 }),
  });

  const items = (data?.items ?? []).filter((u) => {
    const s = search.toLowerCase();
    return !s || (u.email ?? '').toLowerCase().includes(s) || (u.fullName ?? u.name ?? '').toLowerCase().includes(s);
  });

  return (
    <>
      <PageHeader
        title="Users"
        description={data ? `${data.total ?? items.length} member${(data.total ?? items.length) === 1 ? '' : 's'}` : 'Loading…'}
        actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add user</Button>}
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-8" />
        </div>

        {isLoading ? (
          <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title={search ? 'No users match' : 'No users yet'} action={!search && <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Add user</Button>} />
        ) : (
          <Table>
            <THead>
              <TR><TH>User</TH><TH>Email</TH><TH>Phone</TH><TH>Roles</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {items.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={u.fullName ?? u.name ?? u.email} />
                      <span className="font-medium">{u.fullName ?? u.name ?? '—'}</span>
                    </div>
                  </TD>
                  <TD className="text-sm text-[color:var(--color-fg-muted)]">{u.email ?? '—'}</TD>
                  <TD className="text-sm text-[color:var(--color-fg-muted)] font-mono">{u.phone ?? '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).slice(0, 3).map((r, i) => {
                        const name = typeof r === 'string' ? r : r.name ?? '';
                        return <Badge key={i} tone="primary" size="sm">{name}</Badge>;
                      })}
                    </div>
                  </TD>
                  <TD><Badge tone={u.status === 'ACTIVE' || !u.status ? 'success' : 'neutral'}>{u.status ?? 'ACTIVE'}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <NewUserDialog open={open} onOpenChange={setOpen} onCreated={() => { qc.invalidateQueries({ queryKey: ['users'] }); setOpen(false); }} />
    </>
  );
}

function NewUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/users', { name: v.name, email: v.email || undefined, phone: v.phone || undefined, password: v.password }),
    onSuccess: () => { toast.success('User added'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Add user" description="Create an account so they can sign in or use WhatsApp." />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="name" required>Full name</Label>
              <Input id="name" {...register('name')} placeholder="Jane Doe" />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="jane@company.com" />
                <FieldError>{errors.email?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp number</Label>
                <Input id="phone" {...register('phone')} placeholder="+91…" />
              </div>
            </div>
            <div>
              <Label htmlFor="password" required>Temporary password</Label>
              <Input id="password" type="text" {...register('password')} placeholder="At least 8 characters" />
              <FieldError>{errors.password?.message}</FieldError>
              <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">Share this with the user securely. They can change it later.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Add user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
