'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { visibleNav, type NavItem } from './nav-config';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';
import { useRole } from '@/lib/roles';

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[color:var(--color-overlay)] backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-[color:var(--color-canvas)] border-r border-[color:var(--color-border)]',
          'transition-[width,transform] duration-200',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <SidebarHeader collapsed={collapsed} onCloseMobile={onCloseMobile} />
        <SidebarNav collapsed={collapsed} onNavigate={onCloseMobile} />
        <SidebarFooter collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </aside>
    </>
  );
}

function SidebarHeader({ collapsed, onCloseMobile }: { collapsed: boolean; onCloseMobile: () => void }) {
  return (
    <div className="h-[var(--topbar-height)] px-3 border-b border-[color:var(--color-border)] flex items-center justify-between flex-shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          P
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-[color:var(--color-fg)]">PhotonX</p>
            <p className="text-[10px] text-[color:var(--color-fg-muted)] truncate -mt-0.5">WorkOS</p>
          </div>
        )}
      </Link>
      <button
        onClick={onCloseMobile}
        className="lg:hidden h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)]"
        aria-label="Close menu"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { roles, loaded } = useRole();
  // Show empty until role hydrates so we don't flash admin items to a USER.
  const groups = loaded ? visibleNav(roles) : [];

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && !collapsed && (
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-fg-subtle)]">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isActive(pathname, item)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm font-medium transition-colors group relative',
        active
          ? 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]'
          : 'text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-fg)]',
        collapsed && 'justify-center',
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-[color:var(--color-primary)]')} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <Badge tone="primary" size="sm">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );
}

function SidebarFooter({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <div className="border-t border-[color:var(--color-border)] p-2 flex-shrink-0">
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex w-full h-8 items-center justify-center rounded-md text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-fg)] transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return {
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    toggleCollapse: () => setCollapsed((v) => !v),
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
  };
}
