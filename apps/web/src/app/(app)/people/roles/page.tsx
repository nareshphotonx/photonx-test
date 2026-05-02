'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';

type Role = { id: string; name: string; description?: string | null; permissions?: Array<{ name?: string } | string> };

export default function RolesPage() {
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => get<{ items: Role[] }>('/roles') });
  const perms = useQuery({ queryKey: ['permissions'], queryFn: () => get<{ items: Array<{ name: string }> }>('/permissions') });

  const items = roles.data?.items ?? [];

  return (
    <>
      <PageHeader title="Roles & Permissions" description={`${items.length} roles · ${perms.data?.items?.length ?? 0} permissions`} />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {roles.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No roles" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{r.name}</CardTitle>
                      {r.description && <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">{r.description}</p>}
                    </div>
                    <Badge tone="primary">{r.permissions?.length ?? 0} permissions</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {(r.permissions ?? []).slice(0, 30).map((p, i) => {
                      const name = typeof p === 'string' ? p : p.name ?? '';
                      return <Badge key={i} tone="neutral" size="sm" className="font-mono">{name}</Badge>;
                    })}
                    {(r.permissions?.length ?? 0) > 30 && (
                      <Badge tone="info" size="sm">+{(r.permissions?.length ?? 0) - 30} more</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
