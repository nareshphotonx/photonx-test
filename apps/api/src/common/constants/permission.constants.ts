export const PERMISSIONS = {
  TENANTS_CREATE: 'tenants:create',
  TENANTS_READ_CURRENT: 'tenants:read_current',
  TENANT_SETTINGS_UPDATE: 'tenant_settings:update',

  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_IMPORT: 'users:import',

  TEAMS_CREATE: 'teams:create',
  TEAMS_READ: 'teams:read',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_MEMBERS_WRITE: 'teams:members:write',

  USER_ROLES_ASSIGN: 'user_roles:assign',
  ROLES_READ: 'roles:read',
  PERMISSIONS_READ: 'permissions:read',

  OFFICE_LOCATIONS_CREATE: 'office_locations:create',
  OFFICE_LOCATIONS_READ: 'office_locations:read',
  OFFICE_IPS_CREATE: 'office_ips:create',
  OFFICE_IPS_READ: 'office_ips:read',
  OFFICE_POLICY_CHECK: 'office_policy:check',

  NOTIFICATION_SELF_READ: 'notification_preferences:self:read',
  NOTIFICATION_SELF_UPDATE: 'notification_preferences:self:update',

  PROJECTS_CREATE: 'projects:create',
  PROJECTS_READ: 'projects:read',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_MEMBERS_WRITE: 'projects:members:write',
  PROJECTS_COSTS_WRITE: 'projects:costs:write',
  PROJECTS_BURN_READ: 'projects:burn:read',

  MILESTONES_CREATE: 'milestones:create',
  MILESTONES_READ: 'milestones:read',
  MILESTONES_UPDATE: 'milestones:update',
  MILESTONES_DELETE: 'milestones:delete',

  TASK_STATUSES_CREATE: 'task_statuses:create',
  TASK_STATUSES_READ: 'task_statuses:read',
  TASK_STATUSES_UPDATE: 'task_statuses:update',
  TASK_STATUSES_DELETE: 'task_statuses:delete',

  TASK_WORKFLOWS_CREATE: 'task_workflows:create',
  TASK_WORKFLOWS_READ: 'task_workflows:read',

  TASKS_CREATE: 'tasks:create',
  TASKS_READ: 'tasks:read',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_STATUS_UPDATE: 'tasks:status:update',
  TASKS_KANBAN_READ: 'tasks:kanban:read',
  TASKS_BULK_UPDATE: 'tasks:bulk:update',
  TASKS_DEPENDENCIES_WRITE: 'tasks:dependencies:write',
  TASKS_COMMENTS_CREATE: 'tasks:comments:create',
  TASKS_COMMENTS_READ: 'tasks:comments:read',

  ATTACHMENTS_PRESIGNED_URL: 'attachments:presigned_url:create',
  ATTACHMENTS_CONFIRM_UPLOAD: 'attachments:confirm_upload',
  ATTACHMENTS_READ: 'attachments:read',
} as const;

export type PermissionCode =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
