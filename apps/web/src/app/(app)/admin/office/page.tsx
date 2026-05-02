'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Network, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, FieldError, Input, Label, PageHeader, Skeleton,
  TabsContent, TabsList, TabsRoot, TabsTrigger,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Location = { id: string; name: string; address?: string; latitude?: number; longitude?: number; isActive?: boolean };
type Ip = { id: string; cidr?: string; label?: string; isActive?: boolean };

const locSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});
const ipSchema = z.object({
  ipAddress: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, 'Use IPv4 like 203.0.113.10 or 203.0.113.0/24'),
  description: z.string().optional(),
});

export default function OfficeAdminPage() {
  return (
    <>
      <PageHeader
        title="Office & Policy"
        description="Configure where your team works from. Used for attendance check-in rules."
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <TabsRoot defaultValue="locations">
          <TabsList>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="ips">Office IPs</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
          </TabsList>
          <TabsContent value="locations"><LocationsTab /></TabsContent>
          <TabsContent value="ips"><IpsTab /></TabsContent>
          <TabsContent value="policy"><PolicyTab /></TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}

function LocationsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['office-locations'], queryFn: () => get<{ items?: Location[] } | Location[]>('/office-locations') });
  const items = Array.isArray(data) ? data : data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof locSchema>>({ resolver: zodResolver(locSchema) });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof locSchema>) => post('/office-locations', {
      name: v.name, address: v.address,
      latitude: v.latitude ? Number(v.latitude) : undefined,
      longitude: v.longitude ? Number(v.longitude) : undefined,
      isActive: true,
    }),
    onSuccess: () => { toast.success('Location added'); reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['office-locations'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add location</Button>
      </div>
      {isLoading ? <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
        : items.length === 0 ? <EmptyState icon={MapPin} title="No office locations" description="Add at least one to enable location-based attendance." />
        : (
          <Card><CardBody className="p-0">
            <Table>
              <THead><TR><TH>Name</TH><TH>Address</TH><TH>Coordinates</TH><TH>Status</TH></TR></THead>
              <TBody>
                {items.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-medium">{l.name}</TD>
                    <TD className="text-sm text-[color:var(--color-fg-muted)]">{l.address ?? '—'}</TD>
                    <TD className="text-xs font-mono text-[color:var(--color-fg-muted)]">{l.latitude && l.longitude ? `${l.latitude}, ${l.longitude}` : '—'}</TD>
                    <TD><Badge tone={l.isActive ? 'success' : 'neutral'}>{l.isActive ? 'Active' : 'Inactive'}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody></Card>
        )}

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="Add office location" />
          <form onSubmit={handleSubmit((v) => create.mutate(v))}>
            <DialogBody className="space-y-4">
              <div><Label htmlFor="name" required>Name</Label><Input id="name" {...register('name')} placeholder="HQ Bangalore" /><FieldError>{errors.name?.message}</FieldError></div>
              <div><Label htmlFor="address" required>Address</Label><Input id="address" {...register('address')} placeholder="100 Main St, Bangalore" /><FieldError>{errors.address?.message}</FieldError></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="latitude">Latitude</Label><Input id="latitude" {...register('latitude')} placeholder="12.9716" /></div>
                <div><Label htmlFor="longitude">Longitude</Label><Input id="longitude" {...register('longitude')} placeholder="77.5946" /></div>
              </div>
              <p className="text-xs text-[color:var(--color-fg-muted)]">💡 Tip: open Google Maps, right-click your office, copy lat/long.</p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add location</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function IpsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['office-ips'], queryFn: () => get<{ items?: Ip[] } | Ip[]>('/office-ips') });
  const items = Array.isArray(data) ? data : data?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof ipSchema>>({ resolver: zodResolver(ipSchema) });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof ipSchema>) => post('/office-ips', { cidr: v.cidr, label: v.label, isActive: true }),
    onSuccess: () => { toast.success('IP added'); reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['office-ips'] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add IP</Button>
      </div>
      {isLoading ? <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
        : items.length === 0 ? <EmptyState icon={Network} title="No office IPs" description="Allow check-in only from these IPs (or ranges in CIDR notation)." />
        : (
          <Card><CardBody className="p-0">
            <Table>
              <THead><TR><TH>IP / CIDR</TH><TH>Label</TH><TH>Status</TH></TR></THead>
              <TBody>
                {items.map((ip) => (
                  <TR key={ip.id}>
                    <TD className="font-mono">{ip.cidr ?? '—'}</TD>
                    <TD className="text-sm text-[color:var(--color-fg-muted)]">{ip.label ?? '—'}</TD>
                    <TD><Badge tone={ip.isActive ? 'success' : 'neutral'}>{ip.isActive ? 'Active' : 'Inactive'}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody></Card>
        )}

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title="Add office IP" description="Use IPv4 like 203.0.113.10 or a range like 203.0.113.0/24." />
          <form onSubmit={handleSubmit((v) => create.mutate(v))}>
            <DialogBody className="space-y-4">
              <div><Label htmlFor="cidr" required>IP / CIDR</Label><Input id="cidr" className="font-mono" {...register('cidr')} placeholder="203.0.113.0/24" /><FieldError>{errors.cidr?.message}</FieldError></div>
              <div><Label htmlFor="label">Label</Label><Input id="label" {...register('label')} placeholder="Mumbai office Wi-Fi" /></div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Add IP</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function PolicyTab() {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const test = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await get<unknown>('/office-policy/check', { ip });
      setResult(res);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Test office policy</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[color:var(--color-fg-muted)]">Enter an IP address to see if it would be allowed for in-office check-in.</p>
        <div className="flex gap-2">
          <Input className="font-mono" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.42" />
          <Button onClick={test} loading={loading} disabled={!ip}>Check</Button>
        </div>
        {!!result && (
          <pre className="text-xs bg-[color:var(--color-surface-2)] p-3 rounded-lg overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        )}
      </CardBody>
    </Card>
  );
}
