'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Settings, UserPlus, UserMinus, UsersRound } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Select, Skeleton, Textarea,
} from '@/components/ui';
import { del, get, getApiErrorMessage, post } from '@/lib/api';

type TeamMember = { id: string; name?: string; fullName?: string; email?: string };
type Team = { id: string; name: string; description?: string | null; members?: TeamMember[]; memberCount?: number };
type UserRow = { id: string; name?: string; fullName?: string; email?: string };

const schema = z.object({ name: z.string().min(2, 'Name required'), description: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export default function TeamsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => get<{ items: Team[] }>('/teams') });
  const items = data?.items ?? [];
  const manageTeam = items.find((t) => t.id === manageId) ?? null;

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
              <Card key={t.id}>
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
                        <Avatar key={m.id} size="xs" name={m.fullName ?? m.name ?? m.email} className="ring-2 ring-[color:var(--color-surface)]" />
                      ))}
                      {t.members.length > 5 && (
                        <span className="h-6 w-6 rounded-full bg-[color:var(--color-surface-2)] text-[10px] flex items-center justify-center font-medium ring-2 ring-[color:var(--color-surface)]">
                          +{t.members.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-[color:var(--color-border)]">
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => setManageId(t.id)}>
                      <Settings className="h-3.5 w-3.5" /> Manage members
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewTeamDialog open={open} onOpenChange={setOpen} onCreated={() => { qc.invalidateQueries({ queryKey: ['teams'] }); setOpen(false); }} />
      {manageTeam && (
        <MembersDialog team={manageTeam} onClose={() => setManageId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ['teams'] })} />
      )}
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

function MembersDialog({ team, onClose, onChanged }: { team: Team; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [pickUserId, setPickUserId] = useState('');

  // The API returns { id, name, description, memberIds } — we need to resolve userIds to user objects.
  const detail = useQuery({
    queryKey: ['team', team.id],
    queryFn: () => get<Team & { memberIds?: string[] }>(`/teams/${team.id}`),
  });
  const allUsers = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: UserRow[] }>('/users', { limit: 100 }) });

  const memberIdSet = new Set(detail.data?.memberIds ?? team.members?.map((m) => m.id) ?? []);
  const userMap = new Map((allUsers.data?.items ?? []).map((u) => [u.id, u] as const));
  const members: TeamMember[] = Array.from(memberIdSet).map((id) => {
    const u = userMap.get(id);
    return { id, name: u?.name, fullName: u?.fullName, email: u?.email };
  });
  const candidates = (allUsers.data?.items ?? []).filter((u) => !memberIdSet.has(u.id));

  const add = useMutation({
    mutationFn: (userId: string) => post(`/teams/${team.id}/members`, { userIds: [userId] }),
    onSuccess: () => {
      toast.success('Member added');
      setPickUserId('');
      qc.invalidateQueries({ queryKey: ['team', team.id] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      onChanged();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => del(`/teams/${team.id}/members/${userId}`),
    onSuccess: () => {
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: ['team', team.id] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      onChanged();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader title={`${team.name} · Members`} description={team.description ?? undefined} />
        <DialogBody className="space-y-4">
          <div>
            <Label>Add a member</Label>
            <div className="flex gap-2">
              <Select value={pickUserId} onChange={(e) => setPickUserId(e.target.value)} disabled={!candidates.length}>
                <option value="">{candidates.length ? 'Select user…' : 'All users already in this team'}</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>
                ))}
              </Select>
              <Button onClick={() => pickUserId && add.mutate(pickUserId)} loading={add.isPending} disabled={!pickUserId}>
                <UserPlus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <div>
            <Label>Current members ({members.length})</Label>
            {detail.isLoading ? (
              <Skeleton className="h-32" />
            ) : members.length === 0 ? (
              <p className="text-sm text-[color:var(--color-fg-muted)] italic px-1 py-3">No members yet.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)] border border-[color:var(--color-border)] rounded-lg overflow-hidden">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar size="sm" name={m.fullName ?? m.name ?? m.email} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.fullName ?? m.name ?? '—'}</p>
                      <p className="text-xs text-[color:var(--color-fg-muted)] truncate">{m.email ?? ''}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm(`Remove ${m.fullName ?? m.name ?? m.email} from the team?`)) remove.mutate(m.id); }}
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
