import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeStyles = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)] border border-[color:var(--color-border)]',
        primary: 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] border border-[color:var(--color-brand-200)]',
        success: 'bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] border border-green-200',
        warning: 'bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)] border border-amber-200',
        danger: 'bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border border-red-200',
        info: 'bg-[color:var(--color-info-soft)] text-[color:var(--color-info)] border border-blue-200',
      },
      size: {
        sm: 'h-5 text-[10px] px-1.5',
        md: 'h-6',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export function Badge({
  children,
  tone,
  size,
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: VariantProps<typeof badgeStyles>['tone'];
  size?: VariantProps<typeof badgeStyles>['size'];
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn(badgeStyles({ tone, size }), className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
