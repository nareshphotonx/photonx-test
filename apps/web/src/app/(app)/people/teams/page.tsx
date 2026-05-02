'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, UsersRound } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton, Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Team = { id: string; name: string; description?: string | null; members?: Array<{ id: string; name?: string; email?: string }>; memberCount?: number };
const schema = z.object({ name: z.string().min(2, 'Name required'), description: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export default function TeamsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => get<{ items: Team[] }>('/teams') });
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="Teams" description={`${items.length} team${items.length === 1 ? '' : 's'}`} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New team</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={UsersRound} title="No teams yet" description="Group people together for projects, approvals, and reporting." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New team</Button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <Card key={t.id} interactive>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] flex items-center justify-center">
                      <UsersRound className="h-5 w-5" />
                    </div>
                    <Badge tone="neutral">{t.memberCount ?? t.members?.length ?? 0} members</Badge>
                  </div>
                  <p className="font-semibold">{t.name}</p>
                  {t.description && <p className="text-xs text-[color:var(--color-fg-muted)] mt-1 line-clamp-2">{t.description}</p>}
                  {t.members && t.members.length > 0 && (
                    <div className="flex -space-x-2 mt-3">
                      {t.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} size="xs" name={m.name ?? m.email} className="ring-2 ring-[color:var(--color-surface)]" />
                      ))}
                      {t.members.length > 5 && (
                        <span className="h-6 w-6 rounded-full bg-[color:var(--color-surface-2)] text-[10px] flex items-center justify-center font-medium ring-2 ring-[color:var(--color-surface)]">
                          +{t.members.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewTeamDialog open={open} onOpenChange={setOpen} onCreated={() => { qc.invalidateQueries({ queryKey: ['teams'] }); setOpen(false); }} />
    </>
  );
}

function NewTeamDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const create = useMutation({
    mutationFn: (v: FormValues) => post('/teams', v),
    onSuccess: () => { toast.success('Team created'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="New team" />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="name" required>Team name</Label>
              <Input id="name" {...register('name')} placeholder="Engineering" />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="What does this team do?" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create team</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
