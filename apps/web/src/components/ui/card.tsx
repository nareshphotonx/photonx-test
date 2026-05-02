import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  interactive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl shadow-xs',
        interactive && 'cursor-pointer transition-all hover:shadow-sm hover:border-[color:var(--color-border-strong)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4 border-b border-[color:var(--color-border)]', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-base font-semibold text-[color:var(--color-fg)]', className)}>{children}</h3>;
}

export function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-[color:var(--color-fg-muted)] mt-0.5', className)}>{children}</p>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-3 border-t border-[color:var(--color-border)] flex items-center justify-end gap-2', className)}>{children}</div>;
}
