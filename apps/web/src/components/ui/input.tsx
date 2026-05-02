'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const inputBase =
  'block w-full h-9 px-3 text-sm rounded-md bg-[color:var(--color-surface)] ' +
  'border border-[color:var(--color-border-strong)] text-[color:var(--color-fg)] ' +
  'placeholder:text-[color:var(--color-fg-subtle)] ' +
  'focus:outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-ring)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(inputBase, 'h-auto min-h-[88px] py-2 leading-6 resize-y', className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(inputBase, 'pr-8 appearance-none bg-no-repeat bg-[right_8px_center]', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")",
        }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Label({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[color:var(--color-fg)] mb-1.5">
      {children}
      {required && <span className="text-[color:var(--color-danger)] ml-0.5">*</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-[color:var(--color-danger)] mt-1.5">{children}</p>;
}
