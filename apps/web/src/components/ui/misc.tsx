'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-[color:var(--color-fg-subtle)]', className ?? 'h-4 w-4')} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

export function Separator({ className, orientation = 'horizontal' }: { className?: string; orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className={cn(
        'bg-[color:var(--color-border)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className,
      )}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon && (
        <div className="h-12 w-12 rounded-xl bg-[color:var(--color-surface-2)] flex items-center justify-center mb-4 text-[color:var(--color-fg-subtle)]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[color:var(--color-fg)]">{title}</h3>
      {description && (
        <p className="text-sm text-[color:var(--color-fg-muted)] mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-canvas)]">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {breadcrumb && <div className="mb-2 text-xs text-[color:var(--color-fg-muted)]">{breadcrumb}</div>}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[color:var(--color-fg)] truncate">{title}</h1>
            {description && <p className="text-sm text-[color:var(--color-fg-muted)] mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label?: string };
  loading?: boolean;
}) {
  const trendPositive = (trend?.value ?? 0) >= 0;
  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-fg-muted)]">{label}</p>
        {Icon && (
          <div className="h-7 w-7 rounded-md bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight text-[color:var(--color-fg)]">{value}</p>
          {trend && (
            <span
              className={cn(
                'text-xs font-medium',
                trendPositive ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]',
              )}
            >
              {trendPositive ? '+' : ''}
              {trend.value}% {trend.label && <span className="text-[color:var(--color-fg-muted)]">· {trend.label}</span>}
            </span>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-[color:var(--color-fg-muted)] mt-1.5">{hint}</p>}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
    xl: 'h-16 w-16 text-xl',
  };
  const initials = (name ?? '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? ''} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
        'bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white',
        sizes[size],
        className,
      )}
    >
      {initials || '?'}
    </div>
  );
}
