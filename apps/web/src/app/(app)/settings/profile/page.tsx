'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton } from '@/components/ui';
import { fetchMe } from '@/lib/auth';
import { storage, type StoredUser } from '@/lib/storage';

export default function ProfileSettingsPage() {
  const [stored, setStored] = useState<StoredUser | null>(null);
  useEffect(() => setStored(storage.getUser()), []);
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, initialData: stored ?? undefined });
  const u = me.data ?? stored;

  if (!u) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardBody className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar size="xl" name={u.fullName ?? u.email} />
            <div>
              <p className="font-semibold">{u.fullName ?? u.email}</p>
              <p className="text-sm text-[color:var(--color-fg-muted)]">{u.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {u.roles?.map((r) => <Badge key={r} tone="primary" size="sm">{r}</Badge>)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[color:var(--color-border)]">
            <div><Label>Email</Label><Input value={u.email ?? ''} readOnly /></div>
            <div><Label>Phone</Label><Input value={u.phone ?? ''} placeholder="—" readOnly /></div>
            <div><Label>Workspace</Label><Input value={storage.getTenantSlug() ?? ''} readOnly /></div>
            <div><Label>User ID</Label><Input value={u.id ?? ''} readOnly className="font-mono text-xs" /></div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardBody>
          <Button variant="secondary">Change password</Button>
        </CardBody>
      </Card>
    </div>
  );
}
