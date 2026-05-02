'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Receipt } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  EmptyState,
  FieldError,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';

type Expense = { id: string; description?: string; amount?: number; currency?: string; status?: string; category?: { name?: string }; project?: { name?: string }; expenseDate?: string; submittedAt?: string };
type Category = { id: string; name: string };
type Project = { id: string; name: string; code: string };

const schema = z.object({
  projectId: z.string().min(1, 'Project required'),
  categoryId: z.string().min(1, 'Category required'),
  amount: z.string().min(1, 'Amount required'),
  currency: z.string().min(1).default('INR'),
  expenseDate: z.string().min(1, 'Date required'),
  description: z.string().min(3, 'Briefly describe the expense'),
});
type FormValues = z.infer<typeof schema>;

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => get<{ items?: Expense[] } | Expense[]>('/expenses') });
  const categories = useQuery({ queryKey: ['expense-categories'], queryFn: () => get<{ items?: Category[] } | Category[]>('/expense-categories') });
  const projects = useQuery({ queryKey: ['projects', 'list'], queryFn: () => get<{ items: Project[] }>('/projects', { limit: 100 }) });

  const items = Array.isArray(data) ? data : data?.items ?? [];
  const cats = Array.isArray(categories.data) ? categories.data : categories.data?.items ?? [];

  const total = items.reduce((s, e) => s + (e.amount ?? 0), 0);
  const approved = items.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + (e.amount ?? 0), 0);
  const pending = items.filter((e) => !e.status || e.status === 'PENDING' || e.status === 'AWAITING_APPROVAL').length;

  return (
    <>
      <PageHeader title="Expenses" description="Submit and track expense claims" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New expense</Button>} />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Total claimed</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums">₹ {total.toLocaleString()}</p>
          </CardBody></Card>
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Approved</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums text-[color:var(--color-success)]">₹ {approved.toLocaleString()}</p>
          </CardBody></Card>
          <Card><CardBody>
            <p className="text-xs text-[color:var(--color-fg-muted)] uppercase tracking-wider font-semibold">Pending</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums">{pending}</p>
          </CardBody></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>All expenses</CardTitle></CardHeader>
          <CardBody className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : items.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses yet" description="Submit an expense claim to get started." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New expense</Button>} />
            ) : (
              <Table>
                <THead><TR><TH>Description</TH><TH>Project</TH><TH>Category</TH><TH>Date</TH><TH>Amount</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {items.map((e) => (
                    <TR key={e.id}>
                      <TD className="font-medium max-w-md truncate">{e.description ?? '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{e.project?.name ?? '—'}</TD>
                      <TD className="text-sm text-[color:var(--color-fg-muted)]">{e.category?.name ?? '—'}</TD>
                      <TD className="text-sm">{e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : '—'}</TD>
                      <TD className="tabular-nums font-medium">{(e.currency ?? '₹')} {(e.amount ?? 0).toLocaleString()}</TD>
                      <TD><Badge tone={e.status === 'APPROVED' ? 'success' : e.status === 'REJECTED' ? 'danger' : 'warning'}>{e.status ?? 'PENDING'}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <NewExpenseDialog open={open} onOpenChange={setOpen} categories={cats} projects={projects.data?.items ?? []} onCreated={() => { qc.invalidateQueries({ queryKey: ['expenses'] }); setOpen(false); }} />
    </>
  );
}

function NewExpenseDialog({ open, onOpenChange, categories, projects, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; categories: Category[]; projects: Project[]; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'INR' },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) => post('/expenses', {
      projectId: v.projectId,
      categoryId: v.categoryId,
      amount: Number(v.amount),
      currency: v.currency,
      expenseDate: new Date(v.expenseDate).toISOString(),
      description: v.description,
    }),
    onSuccess: () => { toast.success('Expense submitted for approval'); reset(); onCreated(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Submit expense" description="Your manager will be notified to approve." />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="description" required>What is this expense for?</Label>
              <Input id="description" {...register('description')} placeholder="e.g. Client lunch with Acme team" />
              <FieldError>{errors.description?.message}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="projectId" required>Project</Label>
                <Select id="projectId" {...register('projectId')}>
                  <option value="">Select project…</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.code} · {p.name}</option>))}
                </Select>
                <FieldError>{errors.projectId?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="categoryId" required>Category</Label>
                <Select id="categoryId" {...register('categoryId')}>
                  <option value="">Select…</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </Select>
                <FieldError>{errors.categoryId?.message}</FieldError>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="amount" required>Amount</Label>
                <Input id="amount" type="number" step="0.01" min="0" {...register('amount')} placeholder="0.00" />
                <FieldError>{errors.amount?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="currency" required>Currency</Label>
                <Select id="currency" {...register('currency')}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="expenseDate" required>Date</Label>
                <Input id="expenseDate" type="date" {...register('expenseDate')} />
                <FieldError>{errors.expenseDate?.message}</FieldError>
              </div>
            </div>
            <p className="text-xs text-[color:var(--color-fg-muted)]">💡 Tip: you can also send <span className="font-mono bg-[color:var(--color-surface-2)] px-1 rounded">expense 450 travel client visit</span> on WhatsApp.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Submit expense</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
