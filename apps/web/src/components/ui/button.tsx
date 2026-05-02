'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all select-none ' +
    'disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]',
  {
    variants: {
      variant: {
        primary:
          'bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] hover:bg-[color:var(--color-primary-hover)] shadow-sm',
        secondary:
          'bg-[color:var(--color-surface)] text-[color:var(--color-fg)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)] shadow-xs',
        ghost: 'bg-transparent text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-2)]',
        outline:
          'bg-transparent text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-2)]',
        danger: 'bg-[color:var(--color-danger)] text-white hover:opacity-90 shadow-sm',
        link: 'bg-transparent text-[color:var(--color-primary)] hover:underline underline-offset-4 px-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-4 text-sm',
        xl: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant, size, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonStyles({ variant, size }), className)}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
});
