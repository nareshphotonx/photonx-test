import { cn } from '@/lib/cn';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl shadow-xs">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-[color:var(--color-surface-2)] border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wider font-semibold text-[color:var(--color-fg-muted)]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-[color:var(--color-border)] last:border-b-0',
        onClick && 'cursor-pointer hover:bg-[color:var(--color-surface-2)] transition-colors',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className, align }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 font-semibold',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, align }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-[color:var(--color-fg)]',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}
