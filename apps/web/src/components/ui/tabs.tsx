'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const TabsRoot = Tabs.Root;

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tabs.List className={cn('inline-flex h-9 items-center gap-1 border-b border-[color:var(--color-border)] w-full', className)}>
      {children}
    </Tabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        'h-9 px-3 text-sm font-medium text-[color:var(--color-fg-muted)] border-b-2 border-transparent -mb-px',
        'hover:text-[color:var(--color-fg)] transition-colors',
        'data-[state=active]:text-[color:var(--color-fg)] data-[state=active]:border-[color:var(--color-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] rounded-t-md',
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <Tabs.Content value={value} className={cn('mt-4 focus-visible:outline-none', className)}>
      {children}
    </Tabs.Content>
  );
}
