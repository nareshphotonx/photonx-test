'use client';

import { Sidebar, useSidebarState } from './sidebar';
import { Topbar } from './topbar';
import { cn } from '@/lib/cn';

export function AppShell({ children }: { children: React.ReactNode }) {
  const s = useSidebarState();

  return (
    <div className="min-h-dvh bg-[color:var(--color-bg)]">
      <Sidebar
        collapsed={s.collapsed}
        onToggleCollapse={s.toggleCollapse}
        mobileOpen={s.mobileOpen}
        onCloseMobile={s.closeMobile}
      />
      <div className={cn('transition-[padding-left] duration-200', s.collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Topbar onOpenMobileMenu={s.openMobile} />
        <main className="min-h-[calc(100dvh-var(--topbar-height))]">{children}</main>
      </div>
    </div>
  );
}
