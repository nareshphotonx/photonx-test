'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { ListChecks } from 'lucide-react';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui';
import { get, getApiErrorMessage, post } from '@/lib/api';
import { cn } from '@/lib/cn';

type KTask = {
  id: string;
  key: string;
  title: string;
  priority?: string;
  dueDate?: string | null;
  taskStatusId?: string;
  assignee?: { id: string; name?: string };
};
type KColumn = {
  id: string;
  name: string;
  code: string;
  isDone?: boolean;
  requiresLocation?: boolean;
  requiresSelfie?: boolean;
  tasks: KTask[];
};
type KanbanData = { projectId: string; columns: KColumn[] };

export function KanbanBoard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'kanban', projectId],
    queryFn: () => get<KanbanData>('/tasks/kanban', { projectId }),
    enabled: !!projectId,
  });

  const [columns, setColumns] = useState<KColumn[]>([]);
  useEffect(() => { if (data?.columns) setColumns(data.columns); }, [data]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const tasksById = useMemo(() => {
    const map = new Map<string, { task: KTask; columnId: string }>();
    columns.forEach((c) => c.tasks.forEach((t) => map.set(t.id, { task: t, columnId: c.id })));
    return map;
  }, [columns]);

  const changeStatus = useMutation({
    mutationFn: async ({ taskId, statusId, requiresLocation }: { taskId: string; statusId: string; requiresLocation?: boolean }) => {
      const body: { statusId: string; locationLatitude?: number; locationLongitude?: number } = { statusId };
      if (requiresLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 60_000 });
          });
          body.locationLatitude = pos.coords.latitude;
          body.locationLongitude = pos.coords.longitude;
        } catch { /* server will reject if strictly required */ }
      }
      return post(`/tasks/${taskId}/status`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Status updated');
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
      qc.invalidateQueries({ queryKey: ['tasks', 'kanban', projectId] });
    },
  });

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const destColumnId = String(e.over.id);
    const current = tasksById.get(taskId);
    if (!current || current.columnId === destColumnId) return;

    setColumns((prev) => {
      const moving = current.task;
      return prev.map((c) => {
        if (c.id === current.columnId) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
        if (c.id === destColumnId) return { ...c, tasks: [{ ...moving, taskStatusId: destColumnId }, ...c.tasks] };
        return c;
      });
    });

    const dest = columns.find((c) => c.id === destColumnId);
    changeStatus.mutate({ taskId, statusId: destColumnId, requiresLocation: dest?.requiresLocation });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-72 flex-shrink-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!columns.length) {
    return <EmptyState icon={ListChecks} title="No statuses configured" description="Add statuses for this project from Admin → Task statuses, then come back." />;
  }

  const activeTask = activeId ? tasksById.get(activeId)?.task : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {columns.map((col) => (<Column key={col.id} column={col} />))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2, .8, .2, 1)' }}>
        {activeTask ? <TaskCard task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ column }: { column: KColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="w-72 flex-shrink-0">
      <div className="px-1 mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[color:var(--color-fg-muted)] truncate">{column.name}</p>
          {column.isDone && <Badge tone="success" size="sm">Done</Badge>}
          {column.requiresLocation && <span title="Requires location"><Badge tone="warning" size="sm">📍</Badge></span>}
        </div>
        <Badge tone="neutral" size="sm">{column.tasks.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-2 min-h-[180px] rounded-lg p-2 transition-colors',
          isOver
            ? 'bg-[color:var(--color-primary-soft)] ring-2 ring-[color:var(--color-primary)] ring-offset-1'
            : 'bg-[color:var(--color-surface-2)]',
        )}
      >
        {column.tasks.length === 0 && (
          <div className="text-center text-xs text-[color:var(--color-fg-subtle)] py-8 italic">Drop tasks here</div>
        )}
        {column.tasks.map((t) => (<DraggableTaskCard key={t.id} task={t} />))}
      </div>
    </div>
  );
}

function DraggableTaskCard({ task }: { task: KTask }) {
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('touch-none', isDragging && 'opacity-30')}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: KTask; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'group bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md p-3 transition-all',
        dragging
          ? 'shadow-lg rotate-2 cursor-grabbing'
          : 'hover:shadow-sm hover:border-[color:var(--color-border-strong)] cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <Link
          href={`/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="font-mono text-[10px] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-primary)]"
        >
          {task.key}
        </Link>
        {task.priority && task.priority !== 'MEDIUM' && (
          <Badge tone={priorityTone(task.priority)} size="sm">{task.priority}</Badge>
        )}
      </div>
      <p className="text-sm font-medium leading-snug line-clamp-3">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        {task.dueDate ? (
          <span className="text-[10px] text-[color:var(--color-fg-muted)]">
            Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        ) : <span />}
        {task.assignee && <Avatar size="xs" name={task.assignee.name} />}
      </div>
    </div>
  );
}

function priorityTone(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'CRITICAL') return 'danger';
  if (p === 'HIGH') return 'warning';
  if (p === 'LOW') return 'info';
  return 'neutral';
}
