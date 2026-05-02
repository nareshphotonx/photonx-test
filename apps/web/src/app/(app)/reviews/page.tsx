'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Plus, Star } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, CardBody,
  DialogBody, DialogContent, DialogFooter, DialogHeader, DialogRoot,
  EmptyState, Input, Label, PageHeader, Select, Skeleton, TabsContent, TabsList, TabsRoot, TabsTrigger,
  TBody, TD, TH, THead, TR, Table, Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';
import { cn } from '@/lib/cn';

type Cycle = { id: string; name?: string; periodStart?: string; periodEnd?: string; status?: string; entryCount?: number };
type Entry = {
  id: string;
  cycleId?: string;
  reviewedUserId?: string;
  reviewedUser?: { name?: string; email?: string };
  reviewer?: { name?: string; email?: string };
  status?: string;
  overallRating?: number;
  strengths?: string;
  improvements?: string;
  summary?: string;
};
type UserOpt = { id: string; name?: string; fullName?: string; email?: string };

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [writingFor, setWritingFor] = useState<{ cycleId?: string } | null>(null);

  const cycles = useQuery({ queryKey: ['review-cycles'], queryFn: () => get<{ items?: Cycle[] } | Cycle[]>('/review-cycles') });
  const entries = useQuery({ queryKey: ['reviews'], queryFn: () => get<{ items?: Entry[] } | Entry[]>('/reviews') });

  const cycleItems = Array.isArray(cycles.data) ? cycles.data : cycles.data?.items ?? [];
  const entryItems = Array.isArray(entries.data) ? entries.data : entries.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Performance Reviews"
        description="Cycles and individual reviews"
        actions={
          <>
            <Button variant="secondary" onClick={() => setWritingFor({})}>
              <Plus className="h-4 w-4" /> Write review
            </Button>
            <Button>
              <Plus className="h-4 w-4" /> New cycle
            </Button>
          </>
        }
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <TabsRoot defaultValue="cycles">
          <TabsList>
            <TabsTrigger value="cycles">Cycles ({cycleItems.length})</TabsTrigger>
            <TabsTrigger value="entries">My reviews ({entryItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="cycles">
            {cycles.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            ) : cycleItems.length === 0 ? (
              <EmptyState icon={Star} title="No review cycles yet" description="Start a review cycle to collect feedback across the team." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycleItems.map((c) => (
                  <Card key={c.id}>
                    <CardBody>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{c.name ?? 'Cycle'}</p>
                          <p className="text-xs text-[color:var(--color-fg-muted)] mt-0.5">
                            {c.periodStart && new Date(c.periodStart).toLocaleDateString()}
                            {c.periodEnd && ` → ${new Date(c.periodEnd).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge tone={c.status === 'ACTIVE' ? 'primary' : c.status === 'COMPLETED' ? 'success' : 'neutral'}>{c.status ?? 'DRAFT'}</Badge>
                      </div>
                      <p className="text-xs text-[color:var(--color-fg-muted)] mb-3">{c.entryCount ?? 0} review entries</p>
                      <Button size="sm" variant="ghost" className="w-full" onClick={() => setWritingFor({ cycleId: c.id })}>
                        <Plus className="h-3.5 w-3.5" /> Write review for this cycle
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="entries">
            {entries.isLoading ? (
              <Card><CardBody className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></CardBody></Card>
            ) : entryItems.length === 0 ? (
              <EmptyState icon={Star} title="No reviews yet" />
            ) : (
              <Card>
                <CardBody className="p-0">
                  <Table>
                    <THead><TR><TH>Reviewee</TH><TH>Reviewer</TH><TH>Rating</TH><TH>Status</TH><TH align="right">Actions</TH></TR></THead>
                    <TBody>
                      {entryItems.map((e) => (
                        <TR key={e.id}>
                          <TD className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar size="xs" name={e.reviewedUser?.name ?? e.reviewedUser?.email} />
                              {e.reviewedUser?.name ?? e.reviewedUser?.email ?? '—'}
                            </div>
                          </TD>
                          <TD className="text-sm text-[color:var(--color-fg-muted)]">{e.reviewer?.name ?? e.reviewer?.email ?? '—'}</TD>
                          <TD>{e.overallRating != null ? <RatingStars value={e.overallRating} /> : '—'}</TD>
                          <TD><Badge tone={e.status === 'SUBMITTED' || e.status === 'APPROVED' ? 'success' : e.status === 'IN_PROGRESS' || e.status === 'DRAFT' ? 'warning' : 'neutral'}>{e.status ?? 'DRAFT'}</Badge></TD>
                          <TD align="right">
                            {(e.status === 'DRAFT' || e.status === 'IN_PROGRESS') && (
                              <SubmitEntryButton entryId={e.id} onDone={() => qc.invalidateQueries({ queryKey: ['reviews'] })} />
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </TabsContent>
        </TabsRoot>
      </div>

      {writingFor && (
        <ReviewEntryDialog
          presetCycleId={writingFor.cycleId}
          cycles={cycleItems}
          onClose={() => setWritingFor(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['reviews'] }); setWritingFor(null); }}
        />
      )}
    </>
  );
}

function SubmitEntryButton({ entryId, onDone }: { entryId: string; onDone: () => void }) {
  const submit = useMutation({
    mutationFn: () => post(`/reviews/${entryId}/submit`),
    onSuccess: () => { toast.success('Review submitted'); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  return (
    <Button size="sm" variant="secondary" onClick={() => submit.mutate()} loading={submit.isPending}>
      <CheckCircle2 className="h-3.5 w-3.5" /> Submit
    </Button>
  );
}

function ReviewEntryDialog({ presetCycleId, cycles, onClose, onSaved }: { presetCycleId?: string; cycles: Cycle[]; onClose: () => void; onSaved: () => void }) {
  const [cycleId, setCycleId] = useState(presetCycleId ?? cycles[0]?.id ?? '');
  const [reviewedUserId, setReviewedUserId] = useState('');
  const [rating, setRating] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [summary, setSummary] = useState('');

  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: UserOpt[] }>('/users', { limit: 100 }) });

  const create = useMutation({
    mutationFn: () => post('/reviews', {
      cycleId,
      reviewedUserId,
      overallRating: rating,
      strengths: strengths || undefined,
      improvements: improvements || undefined,
      summary: summary || undefined,
    }),
    onSuccess: () => { toast.success('Review saved as draft'); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader title="Write a review" description="Drafts are private until you click Submit" />
        <form onSubmit={(e) => { e.preventDefault(); if (cycleId && reviewedUserId) create.mutate(); }}>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cycle" required>Cycle</Label>
                <Select id="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                  <option value="">Select cycle…</option>
                  {cycles.map((c) => (<option key={c.id} value={c.id}>{c.name ?? 'Cycle'}</option>))}
                </Select>
              </div>
              <div>
                <Label htmlFor="reviewee" required>Reviewee</Label>
                <Select id="reviewee" value={reviewedUserId} onChange={(e) => setReviewedUserId(e.target.value)}>
                  <option value="">Select user…</option>
                  {(users.data?.items ?? []).map((u) => (<option key={u.id} value={u.id}>{u.fullName ?? u.name ?? u.email}</option>))}
                </Select>
              </div>
            </div>

            <div>
              <Label>Overall rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={cn(
                      'h-9 w-9 inline-flex items-center justify-center rounded transition-colors',
                      n <= rating ? 'text-[color:var(--color-warning)]' : 'text-[color:var(--color-fg-subtle)] hover:text-[color:var(--color-fg-muted)]',
                    )}
                    aria-label={`${n} stars`}
                  >
                    <Star className={cn('h-6 w-6', n <= rating && 'fill-current')} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-[color:var(--color-fg-muted)]">{rating} / 5</span>
              </div>
            </div>

            <div>
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea id="strengths" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="What did they do well? Specific examples help." />
            </div>
            <div>
              <Label htmlFor="improvements">Areas to improve</Label>
              <Textarea id="improvements" value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Where can they grow next quarter?" />
            </div>
            <div>
              <Label htmlFor="summary">Overall summary</Label>
              <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line take" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={create.isPending} disabled={!cycleId || !reviewedUserId}>Save draft</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5', n <= value ? 'text-[color:var(--color-warning)] fill-[color:var(--color-warning)]' : 'text-[color:var(--color-fg-subtle)]')} />
      ))}
      <span className="ml-1.5 text-xs font-medium tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}
