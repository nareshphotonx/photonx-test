'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, Sparkles, User } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { DropdownContent, DropdownItem, DropdownRoot, DropdownSeparator, DropdownTrigger } from '@/components/ui';
import { cn } from '@/lib/cn';
import { logout } from '@/lib/auth';
import { storage, type StoredUser } from '@/lib/storage';

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  useEffect(() => setUser(storage.getUser()), []);

  return (
    <header className="h-[var(--topbar-height)] bg-[color:var(--color-canvas)] border-b border-[color:var(--color-border)] flex items-center px-4 gap-3 sticky top-0 z-30">
      <button
        onClick={onOpenMobileMenu}
        className="lg:hidden h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)]"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex-1 max-w-xl">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/ai"
          className="hidden sm:inline-flex h-8 px-3 items-center gap-1.5 rounded-md text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-soft)] transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Link>

        <button
          aria-label="Notifications"
          className="relative h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)]"
        >
          <Bell className="h-4 w-4" />
        </button>

        <UserMenu user={user} onLogout={async () => { await logout(); router.replace('/login'); }} />
      </div>
    </header>
  );
}

function GlobalSearch() {
  return (
    <div className="relative group">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--color-fg-subtle)] pointer-events-none" />
      <input
        type="text"
        placeholder="Search projects, tasks, people..."
        className={cn(
          'w-full h-8 pl-8 pr-12 rounded-md text-sm bg-[color:var(--color-surface-2)] border border-transparent',
          'placeholder:text-[color:var(--color-fg-subtle)] text-[color:var(--color-fg)]',
          'focus:outline-none focus:bg-[color:var(--color-surface)] focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-ring)]',
          'transition-all',
        )}
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5 text-[10px] font-medium text-[color:var(--color-fg-subtle)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded px-1.5 py-0.5">
        ⌘K
      </kbd>
    </div>
  );
}

function UserMenu({ user, onLogout }: { user: StoredUser | null; onLogout: () => void }) {
  return (
    <DropdownRoot>
      <DropdownTrigger asChild>
        <button className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md hover:bg-[color:var(--color-surface-2)] transition-colors">
          <Avatar name={user?.fullName ?? user?.email} size="sm" />
          <ChevronDown className="h-3 w-3 text-[color:var(--color-fg-muted)] hidden sm:block" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-[220px]">
        <div className="px-2 py-2 border-b border-[color:var(--color-border)] mb-1">
          <p className="text-sm font-medium text-[color:var(--color-fg)] truncate">
            {user?.fullName ?? user?.email ?? 'You'}
          </p>
          {user?.email && user?.fullName && (
            <p className="text-xs text-[color:var(--color-fg-muted)] truncate">{user.email}</p>
          )}
          {user?.roles && user.roles.length > 0 && (
            <p className="text-[10px] text-[color:var(--color-fg-subtle)] uppercase tracking-wider mt-1">
              {user.roles.join(' · ')}
            </p>
          )}
        </div>
        <DropdownItem icon={User} onSelect={() => (window.location.href = '/settings/profile')}>
          Profile
        </DropdownItem>
        <DropdownItem icon={Settings} onSelect={() => (window.location.href = '/settings/workspace')}>
          Workspace settings
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={LogOut} destructive onSelect={onLogout}>
          Log out
        </DropdownItem>
      </DropdownContent>
    </DropdownRoot>
  );
}
