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
  MessageSquare,
  History,
  MapPin,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/ai', label: 'AI Assistant', icon: Sparkles, badge: 'AI' },
      { href: '/inbox', label: 'Inbox', icon: Bell },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/tasks', label: 'Tasks', icon: ListChecks },
      { href: '/time', label: 'Time entries', icon: Clock },
      { href: '/approvals', label: 'Approvals', icon: CheckCircle2 },
    ],
  },
  {
    label: 'HR',
    items: [
      { href: '/attendance', label: 'Attendance', icon: Briefcase },
      { href: '/leave', label: 'Leave', icon: CalendarDays },
      { href: '/wfh', label: 'Work from home', icon: Home },
      { href: '/holidays', label: 'Holidays', icon: CalendarOff },
      { href: '/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/people/users', label: 'Users', icon: Users },
      { href: '/people/teams', label: 'Teams', icon: UsersRound },
      { href: '/people/roles', label: 'Roles & Permissions', icon: ShieldCheck },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance', label: 'Insights', icon: TrendingUp },
      { href: '/reviews', label: 'Reviews', icon: Star },
      { href: '/documents', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/setup', label: 'Setup checklist', icon: CheckCircle2 },
      { href: '/admin/office', label: 'Office & policy', icon: MapPin },
      { href: '/admin/leave-types', label: 'Leave types', icon: CalendarDays },
      { href: '/admin/task-statuses', label: 'Task statuses', icon: Workflow },
      { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquare },
      { href: '/admin/audit', label: 'Audit log', icon: History },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/settings/profile', label: 'Profile', icon: Settings },
      { href: '/settings/workspace', label: 'Workspace', icon: Building2 },
      { href: '/settings/integrations', label: 'Integrations', icon: Plug },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];
