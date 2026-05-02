'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { getApiErrorMessage } from '@/lib/api';

export function ErrorBanner({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = getApiErrorMessage(error);
  return (
    <div
      className={`bg-[color:var(--color-danger-soft)] border border-red-200 text-[color:var(--color-danger)] rounded-lg p-3 flex items-start gap-3 ${className ?? ''}`}
    >
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Couldn't load this data</p>
        <p className="opacity-80 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
