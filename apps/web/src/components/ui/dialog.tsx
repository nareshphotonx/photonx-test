'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogClose = Dialog.Close;

export function DialogContent({
  children,
  className,
  size = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  } as const;
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className="fixed inset-0 z-50 bg-[color:var(--color-overlay)] backdrop-blur-sm animate-fade-in"
      />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100vw-32px)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl shadow-xl',
          'max-h-[85vh] overflow-y-auto animate-scale-in',
          sizes[size],
          className,
        )}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-6 py-4 border-b border-[color:var(--color-border)] flex items-start justify-between gap-4">
      <div>
        <Dialog.Title className="text-base font-semibold text-[color:var(--color-fg)]">{title}</Dialog.Title>
        {description && (
          <Dialog.Description className="text-sm text-[color:var(--color-fg-muted)] mt-1">
            {description}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)] flex-shrink-0">
        <X className="h-4 w-4" />
      </Dialog.Close>
    </div>
  );
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-[color:var(--color-border)] flex items-center justify-end gap-2">
      {children}
    </div>
  );
}
