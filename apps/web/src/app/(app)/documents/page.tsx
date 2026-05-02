'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BookOpen, FileText, Plus, Search, Tag, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
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
  Textarea,
} from '@/components/ui';
import { del, get, getApiErrorMessage, post } from '@/lib/api';

type Doc = {
  id: string;
  title: string;
  documentType: 'POLICY' | 'SOP' | 'GENERAL';
  tags?: string[];
  createdAt?: string;
  chunkCount?: number;
};

const schema = z.object({
  title: z.string().min(2),
  documentType: z.enum(['POLICY', 'SOP', 'GENERAL']),
  tags: z.string().optional(),
  content: z.string().min(20, 'At least 20 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => get<{ items: Doc[]; total: number }>('/documents'),
  });

  const items = (data?.items ?? []).filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));

  const remove = useMutation({
    mutationFn: (id: string) => del(`/documents/${id}`),
    onSuccess: () => {
      toast.success('Document deleted');
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Tenant-safe documents the AI can search and cite"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add document
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="pl-8" />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={search ? 'No documents match' : 'No documents yet'}
            description={
              search
                ? undefined
                : 'Add policies, SOPs, or general docs. The AI will search them when answering questions.'
            }
            action={!search && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add document</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((d) => (
              <Card key={d.id} className="flex flex-col h-full">
                <CardBody className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.title}</p>
                      <Badge tone={d.documentType === 'POLICY' ? 'primary' : d.documentType === 'SOP' ? 'info' : 'neutral'} size="sm" className="mt-1">
                        {d.documentType}
                      </Badge>
                    </div>
                  </div>
                  {d.tags && d.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {d.tags.slice(0, 4).map((t) => (
                        <Badge key={t} tone="neutral" size="sm">
                          <Tag className="h-2.5 w-2.5" /> {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-[color:var(--color-fg-muted)]">
                    {d.chunkCount != null && `${d.chunkCount} chunks · `}
                    {d.createdAt && new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </CardBody>
                <div className="border-t border-[color:var(--color-border)] px-3 py-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this document?')) remove.mutate(d.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewDocDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['documents'] });
          setOpen(false);
        }}
      />
    </>
  );
}

function NewDocDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { documentType: 'POLICY' },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      post('/documents', {
        title: v.title,
        documentType: v.documentType,
        tags: v.tags ? v.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        content: v.content,
      }),
    onSuccess: () => {
      toast.success('Document added & indexed');
      reset();
      onCreated();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Add document" description="Will be chunked and embedded for the AI to search." />
        <form onSubmit={handleSubmit((v) => create.mutate(v))}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="title" required>Title</Label>
              <Input id="title" {...register('title')} placeholder="Leave Policy 2026" />
              <FieldError>{errors.title?.message}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="documentType" required>Type</Label>
                <Select id="documentType" {...register('documentType')}>
                  <option value="POLICY">Policy</option>
                  <option value="SOP">SOP</option>
                  <option value="GENERAL">General</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" {...register('tags')} placeholder="leave, hr-policy" />
              </div>
            </div>
            <div>
              <Label htmlFor="content" required>Content</Label>
              <Textarea id="content" {...register('content')} className="min-h-48" placeholder="Paste the full text content here…" />
              <FieldError>{errors.content?.message}</FieldError>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Add & index</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
