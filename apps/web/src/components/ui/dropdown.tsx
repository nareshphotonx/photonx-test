'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export const DropdownRoot = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownGroup = DropdownMenu.Group;
export const DropdownLabel = DropdownMenu.Label;

export function DropdownContent({
  children,
  align = 'end',
  side = 'bottom',
  className,
  sideOffset = 6,
}: {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  sideOffset?: number;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[180px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg p-1',
          'animate-scale-in',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  destructive,
  icon: Icon,
  shortcut,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer',
        'focus:outline-none focus:bg-[color:var(--color-surface-2)]',
        destructive ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-fg)]',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-[color:var(--color-fg-subtle)]">{shortcut}</span>}
    </DropdownMenu.Item>
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--color-border)]" />;
}
