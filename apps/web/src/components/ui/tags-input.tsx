'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputBase } from './input';

export function TagsInput({
  value,
  onChange,
  placeholder = 'Add tag and press Enter',
  className,
  maxTags = 10,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  maxTags?: number;
}) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/[,\s]+$/, '');
    if (!t) return;
    if (value.includes(t)) { setDraft(''); return; }
    if (value.length >= maxTags) return;
    onChange([...value, t]);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        inputBase,
        'h-auto min-h-9 py-1.5 px-2 flex flex-wrap items-center gap-1.5 cursor-text',
        className,
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT') {
          target.querySelector<HTMLInputElement>('input')?.focus();
        }
      }}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((t) => t !== tag)); }}
            className="h-4 w-4 rounded inline-flex items-center justify-center hover:bg-[color:var(--color-brand-200)]"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => addTag(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent border-0 outline-0 text-sm h-6 placeholder:text-[color:var(--color-fg-subtle)]"
      />
    </div>
  );
}
