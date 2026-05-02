'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';

type Tenant = { id?: string; name?: string; slug?: string; createdAt?: string };

export default function WorkspaceSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['tenant', 'current'], queryFn: () => get<Tenant>('/tenants/current') });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Workspace details</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Name</Label><Input value={data?.name ?? ''} readOnly /></div>
          <div><Label>Slug</Label><Input value={data?.slug ?? ''} readOnly className="font-mono text-xs" /></div>
          <div><Label>ID</Label><Input value={data?.id ?? ''} readOnly className="font-mono text-xs" /></div>
          <div><Label>Created</Label><Input value={data?.createdAt ? new Date(data.createdAt).toLocaleString() : ''} readOnly /></div>
        </CardBody>
      </Card>
    </div>
  );
}
