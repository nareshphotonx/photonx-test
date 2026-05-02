'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GitBranch, Search } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, Input, Label, PageHeader, Skeleton,
  TabsContent, TabsList, TabsRoot, TabsTrigger,
  TBody, TD, TH, THead, TR, Table,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Unmatched = {
  id: string;
  commitSha?: string;
  commitMessage?: string;
  authorName?: string;
  authorEmail?: string;
  repoName?: string;
  branchName?: string;
  commitUrl?: string;
  receivedAt?: string;
  createdAt?: string;
};

type GhEvent = {
  id: string;
  eventType?: string;
  deliveryId?: string;
  repoName?: string;
  status?: string;
  createdAt?: string;
};

type GhSettings = {
  webhookSecret?: string;
  enabledRepos?: string[];
  defaultRegex?: string;
  isActive?: boolean;
};

export default function GithubAdminPage() {
  return (
    <>
      <PageHeader
        title="GitHub"
        description="Map stray commits to tasks, configure webhook, and inspect events."
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card className="mb-4 bg-gradient-to-br from-[color:var(--color-brand-50)] to-white border-[color:var(--color-brand-200)]">
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[color:var(--color-fg)] text-white flex items-center justify-center flex-shrink-0">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">GitHub task linking</p>
                <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">
                  Commits matching the default regex (<span className="font-mono bg-white px-1 rounded">T-\d+</span>) auto-link to tasks. Anything that
                  doesn&apos;t match lands in <strong>Unmatched commits</strong> below — pick a task key to link it manually.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <TabsRoot defaultValue="unmatched">
          <TabsList>
            <TabsTrigger value="unmatched">Unmatched commits</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="unmatched"><UnmatchedTab /></TabsContent>
          <TabsContent value="events"><EventsTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}

function UnmatchedTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [mapping, setMapping] = useState<Unmatched | null>(null);

  const list = useQuery({
    queryKey: ['github', 'unmatched'],
    queryFn: () => get<{ items?: Unmatched[] } | Unmatched[]>('/integrations/github/unmatched-commits'),
  });
  const items = (Array.isArray(list.data) ? list.data : list.data?.items ?? []).filter((c) =>
    !search || `${c.commitMessage ?? ''} ${c.authorName ?? ''} ${c.repoName ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Unmatched commits</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8" />
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={GitBranch} title="All commits accounted for" description="Commits without a task key will land here for manual mapping." />
        ) : (
          <Table>
            <THead><TR><TH>Commit</TH><TH>Repo / branch</TH><TH>Author</TH><TH>Received</TH><TH align="right">Actions</TH></TR></THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div>
                      <p className="font-mono text-[10px] text-[color:var(--color-fg-muted)]">{c.commitSha?.slice(0, 7)}</p>
                      <p className="text-sm font-medium truncate max-w-md">{c.commitMessage ?? '—'}</p>
                    </div>
                  </TD>
                  <TD className="text-xs">
                    <p>{c.repoName ?? '—'}</p>
                    {c.branchName && <p className="text-[color:var(--color-fg-muted)] font-mono">{c.branchName}</p>}
                  </TD>
                  <TD className="text-sm text-[color:var(--color-fg-muted)]">{c.authorName ?? c.authorEmail ?? '—'}</TD>
                  <TD className="text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap">
                    {c.receivedAt ?? c.createdAt ? new Date(c.receivedAt ?? c.createdAt!).toLocaleString() : '—'}
                  </TD>
                  <TD align="right">
                    <Button size="sm" onClick={() => setMapping(c)}>Map to task</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>

      {mapping && (
        <MapDialog
          commit={mapping}
          onClose={() => setMapping(null)}
          onMapped={() => { qc.invalidateQueries({ queryKey: ['github', 'unmatched'] }); setMapping(null); }}
        />
      )}
    </Card>
  );
}

function MapDialog({ commit, onClose, onMapped }: { commit: Unmatched; onClose: () => void; onMapped: () => void }) {
  const [taskKey, setTaskKey] = useState('');
  const map = useMutation({
    mutationFn: () => post(`/integrations/github/unmatched-commits/${commit.id}/map`, { taskKey: taskKey.trim().toUpperCase() }),
    onSuccess: () => { toast.success(`Linked to ${taskKey}`); onMapped(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader title="Map commit to task" description={commit.commitMessage ?? commit.commitSha?.slice(0, 7)} />
        <form onSubmit={(e) => { e.preventDefault(); if (taskKey.trim()) map.mutate(); }}>
          <DialogBody className="space-y-3">
            <div className="bg-[color:var(--color-surface-2)] rounded-lg p-3 text-xs">
              <p className="font-mono">{commit.commitSha?.slice(0, 7)}</p>
              <p className="mt-1 text-[color:var(--color-fg-muted)]">{commit.repoName} · {commit.branchName ?? 'main'}</p>
            </div>
            <div>
              <Label htmlFor="taskKey" required>Task key</Label>
              <Input
                id="taskKey"
                autoFocus
                value={taskKey}
                onChange={(e) => setTaskKey(e.target.value)}
                placeholder="e.g. T-101"
                className="font-mono uppercase"
              />
              <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">The author will get a WhatsApp prompt to confirm time logged.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={map.isPending} disabled={!taskKey.trim()}>Link commit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function EventsTab() {
  const list = useQuery({
    queryKey: ['github', 'events'],
    queryFn: () => get<{ items?: GhEvent[] } | GhEvent[]>('/integrations/github/events'),
  });
  const items = Array.isArray(list.data) ? list.data : list.data?.items ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>Recent webhook events</CardTitle></CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="p-5 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={GitBranch} title="No webhook events yet" description="Push to a repo with the webhook configured to see events here." />
        ) : (
          <Table>
            <THead><TR><TH>Time</TH><TH>Event</TH><TH>Delivery</TH><TH>Repo</TH><TH>Status</TH></TR></THead>
            <TBody>
              {items.map((e) => (
                <TR key={e.id}>
                  <TD className="text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap">{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</TD>
                  <TD><Badge tone="info">{e.eventType ?? '—'}</Badge></TD>
                  <TD className="font-mono text-xs">{e.deliveryId?.slice(0, 12) ?? '—'}</TD>
                  <TD className="text-xs">{e.repoName ?? '—'}</TD>
                  <TD>{e.status && <Badge tone={e.status === 'PROCESSED' || e.status === 'OK' ? 'success' : 'neutral'} size="sm">{e.status}</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function SettingsTab() {
  const settings = useQuery({
    queryKey: ['github', 'settings'],
    queryFn: () => get<GhSettings>('/integrations/github/settings'),
  });
  const data = settings.data ?? {};

  return (
    <Card>
      <CardHeader><CardTitle>Webhook configuration</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        {settings.isLoading ? <Skeleton className="h-32" /> : (
          <>
            <div>
              <Label>Webhook secret</Label>
              <Input value={data.webhookSecret ? '••••••••••••' : 'Not configured'} readOnly className="font-mono" />
              <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">Set on the repo&apos;s webhook so deliveries are HMAC-verified.</p>
            </div>
            <div>
              <Label>Default task-key regex</Label>
              <Input value={data.defaultRegex ?? 'T-\\d+'} readOnly className="font-mono" />
            </div>
            <div>
              <Label>Status</Label>
              <Badge tone={data.isActive ? 'success' : 'neutral'}>{data.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div>
              <Label>Webhook URL (configure in GitHub)</Label>
              <Input
                value={`${typeof window !== 'undefined' ? window.location.origin.replace('3001', '3000') : 'http://localhost:3000'}/webhooks/github`}
                readOnly
                className="font-mono"
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
