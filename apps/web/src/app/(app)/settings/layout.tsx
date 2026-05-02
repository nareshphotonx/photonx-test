'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Building2, Plug, User } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/workspace', label: 'Workspace', icon: Building2 },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <PageHeader title="Settings" description="Personal and workspace settings" />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
          <nav className="space-y-1">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 h-9 text-sm rounded-md transition-colors',
                    active
                      ? 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] font-medium'
                      : 'text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-fg)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div>{children}</div>
        </div>
      </div>
    </>
  );
}
