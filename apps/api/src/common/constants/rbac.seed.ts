import { Role } from '../enums/role.enum';
import { PERMISSIONS, type PermissionCode } from './permission.constants';

export const DEFAULT_ROLE_DEFINITIONS: Array<{
  code: Role;
  name: string;
  description: string;
}> = [
  {
    code: Role.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Full tenant administration access',
  },
  {
    code: Role.TEAM_LEAD,
    name: 'Team Lead',
    description: 'Team and project management access',
  },
  {
    code: Role.USER,
    name: 'User',
    description: 'Assigned work and self-service access',
  },
];

export const DEFAULT_PERMISSION_DEFINITIONS: Array<{
  code: PermissionCode;
  name: string;
  description: string;
}> = [
  {
    code: PERMISSIONS.TENANTS_CREATE,
    name: 'Create Tenant',
    description: 'Create tenant and onboarding owner',
  },
  {
    code: PERMISSIONS.TENANTS_READ_CURRENT,
    name: 'Read Current Tenant',
    description: 'Read current tenant details',
  },
  {
    code: PERMISSIONS.TENANT_SETTINGS_UPDATE,
    name: 'Update Tenant Settings',
    description: 'Update tenant settings',
  },
  { code: PERMISSIONS.USERS_CREATE, name: 'Create Users', description: 'Create users' },
  { code: PERMISSIONS.USERS_READ, name: 'Read Users', description: 'Read users' },
  { code: PERMISSIONS.USERS_UPDATE, name: 'Update Users', description: 'Update users' },
  { code: PERMISSIONS.USERS_DELETE, name: 'Delete Users', description: 'Delete users' },
  { code: PERMISSIONS.USERS_IMPORT, name: 'Import Users', description: 'Import users' },
  { code: PERMISSIONS.TEAMS_CREATE, name: 'Create Teams', description: 'Create teams' },
  { code: PERMISSIONS.TEAMS_READ, name: 'Read Teams', description: 'Read teams' },
  { code: PERMISSIONS.TEAMS_UPDATE, name: 'Update Teams', description: 'Update teams' },
  {
    code: PERMISSIONS.TEAMS_MEMBERS_WRITE,
    name: 'Manage Team Members',
    description: 'Add or remove team members',
  },
  {
    code: PERMISSIONS.USER_ROLES_ASSIGN,
    name: 'Assign User Roles',
    description: 'Assign roles to users',
  },
  { code: PERMISSIONS.ROLES_READ, name: 'Read Roles', description: 'Read roles' },
  {
    code: PERMISSIONS.PERMISSIONS_READ,
    name: 'Read Permissions',
    description: 'Read permissions',
  },
  {
    code: PERMISSIONS.OFFICE_LOCATIONS_CREATE,
    name: 'Create Office Locations',
    description: 'Create office locations',
  },
  {
    code: PERMISSIONS.OFFICE_LOCATIONS_READ,
    name: 'Read Office Locations',
    description: 'Read office locations',
  },
  {
    code: PERMISSIONS.OFFICE_IPS_CREATE,
    name: 'Create Office IP Rules',
    description: 'Create office IP allowlist entries',
  },
  {
    code: PERMISSIONS.OFFICE_IPS_READ,
    name: 'Read Office IP Rules',
    description: 'Read office IP allowlist entries',
  },
  {
    code: PERMISSIONS.OFFICE_POLICY_CHECK,
    name: 'Check Office Policy',
    description: 'Check office network policy access',
  },
  {
    code: PERMISSIONS.NOTIFICATION_SELF_READ,
    name: 'Read Own Notification Preferences',
    description: 'Read own notification preferences',
  },
  {
    code: PERMISSIONS.NOTIFICATION_SELF_UPDATE,
    name: 'Update Own Notification Preferences',
    description: 'Update own notification preferences',
  },

  { code: PERMISSIONS.PROJECTS_CREATE, name: 'Create Projects', description: 'Create projects' },
  { code: PERMISSIONS.PROJECTS_READ, name: 'Read Projects', description: 'Read projects' },
  { code: PERMISSIONS.PROJECTS_UPDATE, name: 'Update Projects', description: 'Update projects' },
  { code: PERMISSIONS.PROJECTS_DELETE, name: 'Delete Projects', description: 'Delete projects' },
  {
    code: PERMISSIONS.PROJECTS_MEMBERS_WRITE,
    name: 'Manage Project Members',
    description: 'Add project members',
  },
  {
    code: PERMISSIONS.PROJECTS_COSTS_WRITE,
    name: 'Add Project Costs',
    description: 'Add project cost entries',
  },
  {
    code: PERMISSIONS.PROJECTS_BURN_READ,
    name: 'Read Project Burn',
    description: 'Read project burn metrics',
  },

  {
    code: PERMISSIONS.MILESTONES_CREATE,
    name: 'Create Milestones',
    description: 'Create milestones',
  },
  {
    code: PERMISSIONS.MILESTONES_READ,
    name: 'Read Milestones',
    description: 'Read milestones',
  },
  {
    code: PERMISSIONS.MILESTONES_UPDATE,
    name: 'Update Milestones',
    description: 'Update milestones',
  },
  {
    code: PERMISSIONS.MILESTONES_DELETE,
    name: 'Delete Milestones',
    description: 'Delete milestones',
  },

  {
    code: PERMISSIONS.TASK_STATUSES_CREATE,
    name: 'Create Task Statuses',
    description: 'Create task statuses',
  },
  {
    code: PERMISSIONS.TASK_STATUSES_READ,
    name: 'Read Task Statuses',
    description: 'Read task statuses',
  },
  {
    code: PERMISSIONS.TASK_STATUSES_UPDATE,
    name: 'Update Task Statuses',
    description: 'Update task statuses',
  },
  {
    code: PERMISSIONS.TASK_STATUSES_DELETE,
    name: 'Delete Task Statuses',
    description: 'Delete task statuses',
  },

  {
    code: PERMISSIONS.TASK_WORKFLOWS_CREATE,
    name: 'Create Task Workflows',
    description: 'Create task workflows',
  },
  {
    code: PERMISSIONS.TASK_WORKFLOWS_READ,
    name: 'Read Task Workflows',
    description: 'Read task workflows',
  },

  { code: PERMISSIONS.TASKS_CREATE, name: 'Create Tasks', description: 'Create tasks' },
  { code: PERMISSIONS.TASKS_READ, name: 'Read Tasks', description: 'Read tasks' },
  { code: PERMISSIONS.TASKS_UPDATE, name: 'Update Tasks', description: 'Update tasks' },
  { code: PERMISSIONS.TASKS_DELETE, name: 'Delete Tasks', description: 'Delete tasks' },
  {
    code: PERMISSIONS.TASKS_STATUS_UPDATE,
    name: 'Update Task Status',
    description: 'Move task across statuses',
  },
  {
    code: PERMISSIONS.TASKS_KANBAN_READ,
    name: 'Read Task Kanban',
    description: 'Read task kanban view',
  },
  {
    code: PERMISSIONS.TASKS_BULK_UPDATE,
    name: 'Bulk Update Tasks',
    description: 'Bulk update task fields',
  },
  {
    code: PERMISSIONS.TASKS_DEPENDENCIES_WRITE,
    name: 'Manage Task Dependencies',
    description: 'Create and delete dependencies',
  },
  {
    code: PERMISSIONS.TASKS_COMMENTS_CREATE,
    name: 'Create Task Comments',
    description: 'Create task comments',
  },
  {
    code: PERMISSIONS.TASKS_COMMENTS_READ,
    name: 'Read Task Comments',
    description: 'Read task comments',
  },

  {
    code: PERMISSIONS.ATTACHMENTS_PRESIGNED_URL,
    name: 'Create Attachment Presigned URL',
    description: 'Request S3 upload URL for attachment',
  },
  {
    code: PERMISSIONS.ATTACHMENTS_CONFIRM_UPLOAD,
    name: 'Confirm Attachment Upload',
    description: 'Confirm uploaded attachment and persist metadata',
  },
  {
    code: PERMISSIONS.ATTACHMENTS_READ,
    name: 'Read Attachments',
    description: 'Read attachment metadata',
  },
];

export const DEFAULT_ROLE_PERMISSION_CODES: Record<Role, PermissionCode[]> = {
  [Role.SUPER_ADMIN]: DEFAULT_PERMISSION_DEFINITIONS.map((entry) => entry.code),
  [Role.TEAM_LEAD]: [
    PERMISSIONS.TENANTS_READ_CURRENT,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_IMPORT,
    PERMISSIONS.TEAMS_CREATE,
    PERMISSIONS.TEAMS_READ,
    PERMISSIONS.TEAMS_UPDATE,
    PERMISSIONS.TEAMS_MEMBERS_WRITE,
    PERMISSIONS.USER_ROLES_ASSIGN,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.PERMISSIONS_READ,
    PERMISSIONS.OFFICE_LOCATIONS_CREATE,
    PERMISSIONS.OFFICE_LOCATIONS_READ,
    PERMISSIONS.OFFICE_IPS_CREATE,
    PERMISSIONS.OFFICE_IPS_READ,
    PERMISSIONS.OFFICE_POLICY_CHECK,
    PERMISSIONS.NOTIFICATION_SELF_READ,
    PERMISSIONS.NOTIFICATION_SELF_UPDATE,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_DELETE,
    PERMISSIONS.PROJECTS_MEMBERS_WRITE,
    PERMISSIONS.PROJECTS_COSTS_WRITE,
    PERMISSIONS.PROJECTS_BURN_READ,
    PERMISSIONS.MILESTONES_CREATE,
    PERMISSIONS.MILESTONES_READ,
    PERMISSIONS.MILESTONES_UPDATE,
    PERMISSIONS.MILESTONES_DELETE,
    PERMISSIONS.TASK_STATUSES_CREATE,
    PERMISSIONS.TASK_STATUSES_READ,
    PERMISSIONS.TASK_STATUSES_UPDATE,
    PERMISSIONS.TASK_STATUSES_DELETE,
    PERMISSIONS.TASK_WORKFLOWS_CREATE,
    PERMISSIONS.TASK_WORKFLOWS_READ,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.TASKS_READ,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.TASKS_DELETE,
    PERMISSIONS.TASKS_STATUS_UPDATE,
    PERMISSIONS.TASKS_KANBAN_READ,
    PERMISSIONS.TASKS_BULK_UPDATE,
    PERMISSIONS.TASKS_DEPENDENCIES_WRITE,
    PERMISSIONS.TASKS_COMMENTS_CREATE,
    PERMISSIONS.TASKS_COMMENTS_READ,
    PERMISSIONS.ATTACHMENTS_PRESIGNED_URL,
    PERMISSIONS.ATTACHMENTS_CONFIRM_UPLOAD,
    PERMISSIONS.ATTACHMENTS_READ,
  ],
  [Role.USER]: [
    PERMISSIONS.TENANTS_READ_CURRENT,
    PERMISSIONS.OFFICE_POLICY_CHECK,
    PERMISSIONS.NOTIFICATION_SELF_READ,
    PERMISSIONS.NOTIFICATION_SELF_UPDATE,
    PERMISSIONS.TASKS_READ,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.TASKS_STATUS_UPDATE,
    PERMISSIONS.TASKS_KANBAN_READ,
    PERMISSIONS.TASKS_COMMENTS_CREATE,
    PERMISSIONS.TASKS_COMMENTS_READ,
    PERMISSIONS.ATTACHMENTS_READ,
  ],
};
