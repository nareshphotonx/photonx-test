import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  Sparkles,
  BookOpen,
  Clock,
  CalendarDays,
  Home,
  Receipt,
  CheckCircle2,
  Users,
  UsersRound,
  ShieldCheck,
  TrendingUp,
  Star,
  Settings,
  Bell,
  Building2,
  Plug,
  CalendarOff,
  Briefcase,
  Download,
  GitBranch,
  History,
  MapPin,
  MessageSquare,
  User,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/roles';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
  /** If set, only users with at least one of these roles see the item. */
  roles?: Role[];
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
  /** If set, hide the entire group unless user has at least one of these roles. */
  roles?: Role[];
};

const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'TEAM_LEAD', 'USER'];
const MGR: Role[] = ['SUPER_ADMIN', 'TEAM_LEAD'];
const ADMIN: Role[] = ['SUPER_ADMIN'];

export const NAV: NavGroup[] = [
  {
    items: [
      { href: '/me',        label: 'My day',       icon: User,            roles: ALL_ROLES, exact: true },
      { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard, roles: MGR,       exact: true },
      { href: '/ai',        label: 'AI Assistant', icon: Sparkles,        roles: ALL_ROLES, badge: 'AI' },
      { href: '/inbox',     label: 'Inbox',        icon: Bell,            roles: ALL_ROLES },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects',   label: 'Projects',     icon: FolderKanban, roles: ALL_ROLES },
      { href: '/milestones', label: 'Milestones',   icon: GitBranch,    roles: MGR },
      { href: '/tasks',      label: 'Tasks',        icon: ListChecks,   roles: ALL_ROLES },
      { href: '/time',       label: 'Time entries', icon: Clock,        roles: ALL_ROLES },
      { href: '/approvals',  label: 'Approvals',    icon: CheckCircle2, roles: MGR },
    ],
  },
  {
    label: 'HR',
    items: [
      { href: '/attendance', label: 'Attendance',     icon: Briefcase,    roles: ALL_ROLES },
      { href: '/leave',      label: 'Leave',          icon: CalendarDays, roles: ALL_ROLES },
      { href: '/wfh',        label: 'Work from home', icon: Home,         roles: ALL_ROLES },
      { href: '/holidays',   label: 'Holidays',       icon: CalendarOff,  roles: ALL_ROLES },
      { href: '/expenses',   label: 'Expenses',       icon: Receipt,      roles: ALL_ROLES },
    ],
  },
  {
    label: 'People',
    roles: MGR,
    items: [
      { href: '/people/users', label: 'Users',                icon: Users,        roles: MGR },
      { href: '/people/teams', label: 'Teams',                icon: UsersRound,   roles: MGR },
      { href: '/people/roles', label: 'Roles & Permissions',  icon: ShieldCheck,  roles: ADMIN },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance', label: 'Insights',       icon: TrendingUp, roles: MGR },
      { href: '/reviews',     label: 'Reviews',        icon: Star,       roles: ALL_ROLES },
      { href: '/documents',   label: 'Knowledge Base', icon: BookOpen,   roles: ALL_ROLES },
    ],
  },
  {
    label: 'Admin',
    roles: ADMIN,
    items: [
      { href: '/admin/setup',         label: 'Setup checklist',  icon: CheckCircle2, roles: ADMIN },
      { href: '/admin/office',        label: 'Office & policy',  icon: MapPin,       roles: ADMIN },
      { href: '/admin/leave-types',   label: 'Leave types',      icon: CalendarDays, roles: ADMIN },
      { href: '/admin/task-statuses', label: 'Task statuses',    icon: Workflow,     roles: ADMIN },
      { href: '/admin/whatsapp',      label: 'WhatsApp',         icon: MessageSquare, roles: ADMIN },
      { href: '/admin/github',        label: 'GitHub',           icon: GitBranch,    roles: ADMIN },
      { href: '/admin/notifications', label: 'Notifications',    icon: Bell,         roles: ADMIN },
      { href: '/admin/audit',         label: 'Audit log',        icon: History,      roles: ADMIN },
      { href: '/admin/backup',        label: 'Backup & export',  icon: Download,     roles: ADMIN },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/settings/profile',       label: 'Profile',       icon: Settings, roles: ALL_ROLES },
      { href: '/settings/workspace',     label: 'Workspace',     icon: Building2, roles: ADMIN },
      { href: '/settings/integrations',  label: 'Integrations',  icon: Plug,     roles: ADMIN },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell,     roles: ALL_ROLES },
    ],
  },
];

export function visibleNav(userRoles: Role[]): NavGroup[] {
  const has = (needed?: Role[]) => !needed || needed.length === 0 || needed.some((r) => userRoles.includes(r));
  return NAV
    .filter((g) => has(g.roles))
    .map((g) => ({ ...g, items: g.items.filter((i) => has(i.roles)) }))
    .filter((g) => g.items.length > 0);
}
