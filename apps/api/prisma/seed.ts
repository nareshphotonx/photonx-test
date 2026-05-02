import {
  MilestoneStatus,
  Prisma,
  PrismaClient,
  ProjectMemberRole,
  ProjectStatus,
  RecurringFrequency,
  TaskPriority,
  WorkWeekStart,
} from '@prisma/client';
import { hashPassword } from '../src/common/security/password.util';
import {
  DEFAULT_PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSION_CODES,
} from '../src/common/constants/rbac.seed';
import { Role } from '../src/common/enums/role.enum';

const prisma = new PrismaClient();

async function seedTenantRbac(tenantId: string): Promise<void> {
  await prisma.role.createMany({
    data: DEFAULT_ROLE_DEFINITIONS.map((entry) => ({
      tenantId,
      code: entry.code,
      name: entry.name,
      description: entry.description,
      isSystem: true,
    })),
    skipDuplicates: true,
  });

  await prisma.permission.createMany({
    data: DEFAULT_PERMISSION_DEFINITIONS.map((entry) => ({
      tenantId,
      code: entry.code,
      name: entry.name,
      description: entry.description,
    })),
    skipDuplicates: true,
  });

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({ where: { tenantId } }),
    prisma.permission.findMany({ where: { tenantId } }),
  ]);

  const roleIdByCode = new Map(roles.map((entry) => [entry.code, entry.id]));
  const permissionIdByCode = new Map(
    permissions.map((entry) => [entry.code, entry.id]),
  );

  const rolePermissionRows: Array<{
    tenantId: string;
    roleId: string;
    permissionId: string;
  }> = [];

  for (const [roleCode, permissionCodes] of Object.entries(
    DEFAULT_ROLE_PERMISSION_CODES,
  )) {
    const roleId = roleIdByCode.get(roleCode);

    if (!roleId) {
      continue;
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIdByCode.get(permissionCode);

      if (!permissionId) {
        continue;
      }

      rolePermissionRows.push({
        tenantId,
        roleId,
        permissionId,
      });
    }
  }

  await prisma.rolePermission.createMany({
    data: rolePermissionRows,
    skipDuplicates: true,
  });
}

async function upsertMilestone(params: {
  tenantId: string;
  projectId: string;
  name: string;
  status: MilestoneStatus;
  dueDate: Date;
  createdBy: string;
}): Promise<{ id: string }> {
  const existing = await prisma.milestone.findFirst({
    where: {
      tenantId: params.tenantId,
      projectId: params.projectId,
      name: params.name,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.milestone.update({
      where: { id: existing.id },
      data: {
        status: params.status,
        dueDate: params.dueDate,
        updatedBy: params.createdBy,
      },
      select: { id: true },
    });
  }

  return prisma.milestone.create({
    data: {
      tenantId: params.tenantId,
      projectId: params.projectId,
      name: params.name,
      status: params.status,
      dueDate: params.dueDate,
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
    },
    select: { id: true },
  });
}

async function seed(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'photonx-default' },
    create: {
      name: 'PhotonX Demo Tenant',
      slug: 'photonx-default',
      isActive: true,
    },
    update: {
      name: 'PhotonX Demo Tenant',
      isActive: true,
    },
  });

  await prisma.tenantSetting.upsert({
    where: {
      tenantId: tenant.id,
    },
    create: {
      tenantId: tenant.id,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workWeekStart: WorkWeekStart.MONDAY,
      extras: {
        attendanceWindowStart: '09:00',
        attendanceWindowEnd: '10:30',
        officeStartTime: '09:30',
        officeEndTime: '18:30',
        officeGeoFenceMeters: 150,
        optionalHolidayAnnualQuota: 2,
        timeEntryDailyCapHours: 12,
        timeEntryLockDays: 7,
      },
    },
    update: {
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workWeekStart: WorkWeekStart.MONDAY,
      extras: {
        attendanceWindowStart: '09:00',
        attendanceWindowEnd: '10:30',
        officeStartTime: '09:30',
        officeEndTime: '18:30',
        officeGeoFenceMeters: 150,
        optionalHolidayAnnualQuota: 2,
        timeEntryDailyCapHours: 12,
        timeEntryLockDays: 7,
      },
    },
  });

  await seedTenantRbac(tenant.id);

  const [superAdminRole, teamLeadRole, userRole] = await Promise.all([
    prisma.role.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: Role.SUPER_ADMIN,
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: Role.TEAM_LEAD,
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: Role.USER,
        },
      },
    }),
  ]);

  if (!superAdminRole || !teamLeadRole || !userRole) {
    throw new Error('Failed to resolve seeded system roles');
  }

  const [adminPassword, leadPassword, userPassword] = await Promise.all([
    hashPassword('Admin@12345'),
    hashPassword('TeamLead@12345'),
    hashPassword('User@12345'),
  ]);

  const superAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'superadmin@photonx.dev',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Super Admin',
      email: 'superadmin@photonx.dev',
      phone: '+919900000001',
      passwordHash: adminPassword,
      isActive: true,
    },
    update: {
      name: 'Super Admin',
      phone: '+919900000001',
      passwordHash: adminPassword,
      isActive: true,
      deletedAt: null,
      deletedBy: null,
    },
  });

  const teamLead = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'teamlead@photonx.dev',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Team Lead',
      email: 'teamlead@photonx.dev',
      phone: '+919900000002',
      passwordHash: leadPassword,
      isActive: true,
    },
    update: {
      name: 'Team Lead',
      phone: '+919900000002',
      passwordHash: leadPassword,
      isActive: true,
      deletedAt: null,
      deletedBy: null,
    },
  });

  const normalUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'user@photonx.dev',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Standard User',
      email: 'user@photonx.dev',
      phone: '+919900000003',
      passwordHash: userPassword,
      isActive: true,
    },
    update: {
      name: 'Standard User',
      phone: '+919900000003',
      passwordHash: userPassword,
      isActive: true,
      deletedAt: null,
      deletedBy: null,
    },
  });

  await prisma.userRole.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
      {
        tenantId: tenant.id,
        userId: teamLead.id,
        roleId: teamLeadRole.id,
      },
      {
        tenantId: tenant.id,
        userId: normalUser.id,
        roleId: userRole.id,
      },
    ],
    skipDuplicates: true,
  });

  const team = await prisma.team.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Core Team',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Core Team',
      description: 'Seeded default team',
    },
    update: {
      description: 'Seeded default team',
    },
  });

  await prisma.teamMember.createMany({
    data: [
      {
        tenantId: tenant.id,
        teamId: team.id,
        userId: teamLead.id,
      },
      {
        tenantId: tenant.id,
        teamId: team.id,
        userId: normalUser.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.notificationPreference.createMany({
    data: [
      { tenantId: tenant.id, userId: superAdmin.id },
      { tenantId: tenant.id, userId: teamLead.id },
      { tenantId: tenant.id, userId: normalUser.id },
    ],
    skipDuplicates: true,
  });

  const project = await prisma.project.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'T',
      },
    },
    create: {
      tenantId: tenant.id,
      teamId: team.id,
      name: 'Tenant Platform Upgrade',
      code: 'T',
      description: 'Seeded Phase 2 project',
      status: ProjectStatus.ACTIVE,
      budgetAmount: new Prisma.Decimal(150000),
      budgetCurrency: 'INR',
      overheadPercent: new Prisma.Decimal(12.5),
      createdBy: superAdmin.id,
      updatedBy: superAdmin.id,
      nextTaskSequence: 101,
    },
    update: {
      teamId: team.id,
      name: 'Tenant Platform Upgrade',
      description: 'Seeded Phase 2 project',
      status: ProjectStatus.ACTIVE,
      budgetAmount: new Prisma.Decimal(150000),
      budgetCurrency: 'INR',
      overheadPercent: new Prisma.Decimal(12.5),
      updatedBy: superAdmin.id,
    },
  });

  await prisma.rateCard.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: superAdmin.id,
        hourlyRate: new Prisma.Decimal(2500),
        currency: 'INR',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: superAdmin.id,
      },
      {
        tenantId: tenant.id,
        userId: teamLead.id,
        hourlyRate: new Prisma.Decimal(1800),
        currency: 'INR',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: superAdmin.id,
      },
      {
        tenantId: tenant.id,
        userId: normalUser.id,
        hourlyRate: new Prisma.Decimal(1200),
        currency: 'INR',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: superAdmin.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.projectMember.createMany({
    data: [
      {
        tenantId: tenant.id,
        projectId: project.id,
        userId: superAdmin.id,
        role: ProjectMemberRole.OWNER,
      },
      {
        tenantId: tenant.id,
        projectId: project.id,
        userId: teamLead.id,
        role: ProjectMemberRole.MANAGER,
      },
      {
        tenantId: tenant.id,
        projectId: project.id,
        userId: normalUser.id,
        role: ProjectMemberRole.CONTRIBUTOR,
      },
    ],
    skipDuplicates: true,
  });

  const milestone = await upsertMilestone({
    tenantId: tenant.id,
    projectId: project.id,
    name: 'Phase 2 Foundations',
    status: MilestoneStatus.IN_PROGRESS,
    dueDate: new Date('2026-07-15T00:00:00.000Z'),
    createdBy: superAdmin.id,
  });

  const [todoStatus, progressStatus, doneStatus] = await Promise.all([
    prisma.taskStatus.upsert({
      where: {
        tenantId_projectId_code: {
          tenantId: tenant.id,
          projectId: project.id,
          code: 'TODO',
        },
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        name: 'To Do',
        code: 'TODO',
        position: 1,
        isDone: false,
        requiresLocation: false,
        requiresSelfie: false,
        isDefault: true,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
      update: {
        name: 'To Do',
        position: 1,
        isDone: false,
        requiresLocation: false,
        requiresSelfie: false,
        isDefault: true,
        updatedBy: superAdmin.id,
        deletedAt: null,
      },
    }),
    prisma.taskStatus.upsert({
      where: {
        tenantId_projectId_code: {
          tenantId: tenant.id,
          projectId: project.id,
          code: 'IN_PROGRESS',
        },
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        name: 'In Progress',
        code: 'IN_PROGRESS',
        position: 2,
        isDone: false,
        requiresLocation: false,
        requiresSelfie: false,
        isDefault: false,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
      update: {
        name: 'In Progress',
        position: 2,
        isDone: false,
        requiresLocation: false,
        requiresSelfie: false,
        updatedBy: superAdmin.id,
        deletedAt: null,
      },
    }),
    prisma.taskStatus.upsert({
      where: {
        tenantId_projectId_code: {
          tenantId: tenant.id,
          projectId: project.id,
          code: 'DONE',
        },
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        name: 'Done',
        code: 'DONE',
        position: 3,
        isDone: true,
        requiresLocation: false,
        requiresSelfie: false,
        isDefault: false,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
      update: {
        name: 'Done',
        position: 3,
        isDone: true,
        requiresLocation: false,
        requiresSelfie: false,
        updatedBy: superAdmin.id,
        deletedAt: null,
      },
    }),
  ]);

  await prisma.taskStatus.updateMany({
    where: {
      tenantId: tenant.id,
      projectId: project.id,
      id: {
        not: todoStatus.id,
      },
    },
    data: {
      isDefault: false,
    },
  });

  const workflow = await prisma.taskWorkflow.upsert({
    where: {
      tenantId_projectId_name: {
        tenantId: tenant.id,
        projectId: project.id,
        name: 'default-flow',
      },
    },
    create: {
      tenantId: tenant.id,
      projectId: project.id,
      name: 'default-flow',
      isDefault: true,
      createdBy: superAdmin.id,
      updatedBy: superAdmin.id,
    },
    update: {
      isDefault: true,
      updatedBy: superAdmin.id,
    },
  });

  await prisma.taskWorkflow.updateMany({
    where: {
      tenantId: tenant.id,
      projectId: project.id,
      id: {
        not: workflow.id,
      },
    },
    data: {
      isDefault: false,
    },
  });

  await prisma.taskWorkflowTransition.deleteMany({
    where: {
      tenantId: tenant.id,
      workflowId: workflow.id,
    },
  });

  await prisma.taskWorkflowTransition.createMany({
    data: [
      {
        tenantId: tenant.id,
        projectId: project.id,
        workflowId: workflow.id,
        fromStatusId: todoStatus.id,
        toStatusId: progressStatus.id,
      },
      {
        tenantId: tenant.id,
        projectId: project.id,
        workflowId: workflow.id,
        fromStatusId: progressStatus.id,
        toStatusId: doneStatus.id,
      },
      {
        tenantId: tenant.id,
        projectId: project.id,
        workflowId: workflow.id,
        fromStatusId: doneStatus.id,
        toStatusId: progressStatus.id,
      },
    ],
  });

  const task1 = await prisma.task.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'T-101',
      },
    },
    create: {
      tenantId: tenant.id,
      projectId: project.id,
      milestoneId: milestone.id,
      taskStatusId: progressStatus.id,
      key: 'T-101',
      title: 'Implement project and task schema',
      description: 'Finalize Phase 2 Prisma models and constraints',
      assigneeId: teamLead.id,
      estimateHours: new Prisma.Decimal(16),
      priority: TaskPriority.HIGH,
      dueDate: new Date('2026-06-10T00:00:00.000Z'),
      tags: ['phase2', 'backend'],
      externalReferences: [
        {
          source: 'jira',
          referenceId: 'PHX-101',
        },
      ],
      createdBy: superAdmin.id,
      updatedBy: superAdmin.id,
    },
    update: {
      title: 'Implement project and task schema',
      description: 'Finalize Phase 2 Prisma models and constraints',
      milestoneId: milestone.id,
      taskStatusId: progressStatus.id,
      assigneeId: teamLead.id,
      estimateHours: new Prisma.Decimal(16),
      priority: TaskPriority.HIGH,
      dueDate: new Date('2026-06-10T00:00:00.000Z'),
      updatedBy: superAdmin.id,
      deletedAt: null,
    },
  });

  const task2 = await prisma.task.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'T-102',
      },
    },
    create: {
      tenantId: tenant.id,
      projectId: project.id,
      milestoneId: milestone.id,
      taskStatusId: todoStatus.id,
      key: 'T-102',
      title: 'Build task workflow endpoints',
      description: 'Expose task status and workflow APIs',
      assigneeId: normalUser.id,
      estimateHours: new Prisma.Decimal(10),
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2026-06-15T00:00:00.000Z'),
      tags: ['api'],
      createdBy: superAdmin.id,
      updatedBy: superAdmin.id,
    },
    update: {
      title: 'Build task workflow endpoints',
      description: 'Expose task status and workflow APIs',
      milestoneId: milestone.id,
      taskStatusId: todoStatus.id,
      assigneeId: normalUser.id,
      estimateHours: new Prisma.Decimal(10),
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2026-06-15T00:00:00.000Z'),
      updatedBy: superAdmin.id,
      deletedAt: null,
    },
  });

  const task3 = await prisma.task.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'T-103',
      },
    },
    create: {
      tenantId: tenant.id,
      projectId: project.id,
      milestoneId: milestone.id,
      parentTaskId: task1.id,
      taskStatusId: todoStatus.id,
      key: 'T-103',
      title: 'Add circular dependency checks',
      description: 'Implement dependency cycle validation tests',
      assigneeId: normalUser.id,
      estimateHours: new Prisma.Decimal(6),
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2026-06-18T00:00:00.000Z'),
      tags: ['tests', 'dependencies'],
      createdBy: superAdmin.id,
      updatedBy: superAdmin.id,
    },
    update: {
      title: 'Add circular dependency checks',
      description: 'Implement dependency cycle validation tests',
      milestoneId: milestone.id,
      parentTaskId: task1.id,
      taskStatusId: todoStatus.id,
      assigneeId: normalUser.id,
      estimateHours: new Prisma.Decimal(6),
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2026-06-18T00:00:00.000Z'),
      updatedBy: superAdmin.id,
      deletedAt: null,
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      nextTaskSequence: Math.max(project.nextTaskSequence, 104),
      updatedBy: superAdmin.id,
    },
  });

  await prisma.taskDependency.upsert({
    where: {
      tenantId_taskId_dependsOnTaskId: {
        tenantId: tenant.id,
        taskId: task2.id,
        dependsOnTaskId: task1.id,
      },
    },
    create: {
      tenantId: tenant.id,
      projectId: project.id,
      taskId: task2.id,
      dependsOnTaskId: task1.id,
      createdBy: superAdmin.id,
    },
    update: {},
  });

  const existingComment = await prisma.taskComment.findFirst({
    where: {
      tenantId: tenant.id,
      taskId: task1.id,
      authorId: superAdmin.id,
      content: 'Please sync with team lead on workflow validation.',
    },
    select: { id: true },
  });

  const comment =
    existingComment ??
    (await prisma.taskComment.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        taskId: task1.id,
        authorId: superAdmin.id,
        content: 'Please sync with team lead on workflow validation.',
      },
      select: { id: true },
    }));

  await prisma.taskCommentMention.upsert({
    where: {
      tenantId_taskCommentId_mentionedUserId: {
        tenantId: tenant.id,
        taskCommentId: comment.id,
        mentionedUserId: teamLead.id,
      },
    },
    create: {
      tenantId: tenant.id,
      taskCommentId: comment.id,
      mentionedUserId: teamLead.id,
    },
    update: {},
  });

  const existingTemplate = await prisma.recurringTaskTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      projectId: project.id,
      name: 'Weekly Workflow Review',
    },
    select: { id: true },
  });

  if (existingTemplate) {
    await prisma.recurringTaskTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        milestoneId: milestone.id,
        teamId: team.id,
        defaultAssigneeId: teamLead.id,
        statusId: todoStatus.id,
        titleTemplate: 'Weekly workflow review',
        description: 'Review status bottlenecks and reopen trends',
        estimateHours: new Prisma.Decimal(2),
        priority: TaskPriority.MEDIUM,
        tags: ['recurring', 'review'],
        externalReferences: [
          {
            source: 'notion',
            referenceId: 'weekly-workflow-review',
          },
        ],
        frequency: RecurringFrequency.WEEKLY,
        interval: 1,
        startsAt: new Date('2026-05-01T09:00:00.000Z'),
        nextRunAt: new Date('2026-05-08T09:00:00.000Z'),
        isActive: true,
        createdBy: superAdmin.id,
      },
    });
  } else {
    await prisma.recurringTaskTemplate.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        milestoneId: milestone.id,
        teamId: team.id,
        defaultAssigneeId: teamLead.id,
        statusId: todoStatus.id,
        name: 'Weekly Workflow Review',
        titleTemplate: 'Weekly workflow review',
        description: 'Review status bottlenecks and reopen trends',
        estimateHours: new Prisma.Decimal(2),
        priority: TaskPriority.MEDIUM,
        tags: ['recurring', 'review'],
        externalReferences: [
          {
            source: 'notion',
            referenceId: 'weekly-workflow-review',
          },
        ],
        frequency: RecurringFrequency.WEEKLY,
        interval: 1,
        startsAt: new Date('2026-05-01T09:00:00.000Z'),
        nextRunAt: new Date('2026-05-08T09:00:00.000Z'),
        isActive: true,
        createdBy: superAdmin.id,
      },
    });
  }

  const existingCost = await prisma.projectCost.findFirst({
    where: {
      tenantId: tenant.id,
      projectId: project.id,
      category: 'cloud-infra',
      costDate: new Date('2026-05-02T00:00:00.000Z'),
    },
    select: { id: true },
  });

  if (!existingCost) {
    await prisma.projectCost.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        amount: new Prisma.Decimal(4500.75),
        currency: 'USD',
        category: 'cloud-infra',
        note: 'Seed monthly infra cost',
        costDate: new Date('2026-05-02T00:00:00.000Z'),
        createdBy: superAdmin.id,
      },
    });
  }

  const leaveTypes = await Promise.all([
    prisma.leaveType.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: 'CASUAL',
        },
      },
      create: {
        tenantId: tenant.id,
        code: 'CASUAL',
        name: 'Casual Leave',
        description: 'General personal leave',
        isActive: true,
      },
      update: {
        name: 'Casual Leave',
        description: 'General personal leave',
        isActive: true,
      },
    }),
    prisma.leaveType.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: 'SICK',
        },
      },
      create: {
        tenantId: tenant.id,
        code: 'SICK',
        name: 'Sick Leave',
        description: 'Health related leave',
        isActive: true,
      },
      update: {
        name: 'Sick Leave',
        description: 'Health related leave',
        isActive: true,
      },
    }),
  ]);

  for (const leaveType of leaveTypes) {
    await prisma.leavePolicy.upsert({
      where: {
        tenantId_leaveTypeId: {
          tenantId: tenant.id,
          leaveTypeId: leaveType.id,
        },
      },
      create: {
        tenantId: tenant.id,
        leaveTypeId: leaveType.id,
        defaultAnnualQuota: new Prisma.Decimal(18),
        monthlyAccrual: new Prisma.Decimal(1.5),
        joiningProration: true,
      },
      update: {
        defaultAnnualQuota: new Prisma.Decimal(18),
        monthlyAccrual: new Prisma.Decimal(1.5),
        joiningProration: true,
      },
    });
  }

  await prisma.leaveUserQuotaOverride.upsert({
    where: {
      tenantId_userId_leaveTypeId: {
        tenantId: tenant.id,
        userId: teamLead.id,
        leaveTypeId: leaveTypes[0].id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: teamLead.id,
      leaveTypeId: leaveTypes[0].id,
      annualQuota: new Prisma.Decimal(24),
      monthlyAccrual: new Prisma.Decimal(2),
    },
    update: {
      annualQuota: new Prisma.Decimal(24),
      monthlyAccrual: new Prisma.Decimal(2),
    },
  });

  await prisma.wfhPolicy.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      defaultAnnualQuota: new Prisma.Decimal(36),
    },
    update: {
      defaultAnnualQuota: new Prisma.Decimal(36),
    },
  });

  await prisma.wfhUserQuotaOverride.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: teamLead.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: teamLead.id,
      annualQuota: new Prisma.Decimal(48),
    },
    update: {
      annualQuota: new Prisma.Decimal(48),
    },
  });

  const [optionalHolidayDate, fixedHolidayDate] = [
    new Date('2026-08-15T00:00:00.000Z'),
    new Date('2026-01-26T00:00:00.000Z'),
  ];

  const optionalHolidayExisting = await prisma.holiday.findFirst({
    where: {
      tenantId: tenant.id,
      locationId: null,
      date: optionalHolidayDate,
      name: 'Founders Optional Day',
    },
    select: { id: true },
  });

  const optionalHoliday =
    optionalHolidayExisting ??
    (await prisma.holiday.create({
      data: {
        tenantId: tenant.id,
        locationId: null,
        name: 'Founders Optional Day',
        date: optionalHolidayDate,
        isOptional: true,
        isActive: true,
      },
      select: { id: true },
    }));

  const fixedHolidayExisting = await prisma.holiday.findFirst({
    where: {
      tenantId: tenant.id,
      locationId: null,
      date: fixedHolidayDate,
      name: 'Republic Day',
    },
    select: { id: true },
  });

  if (!fixedHolidayExisting) {
    await prisma.holiday.create({
      data: {
        tenantId: tenant.id,
        locationId: null,
        name: 'Republic Day',
        date: fixedHolidayDate,
        isOptional: false,
        isActive: true,
      },
    });
  }

  await prisma.optionalHolidayClaim.upsert({
    where: {
      tenantId_userId_holidayId: {
        tenantId: tenant.id,
        userId: normalUser.id,
        holidayId: optionalHoliday.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: normalUser.id,
      holidayId: optionalHoliday.id,
    },
    update: {},
  });

  await prisma.expenseCategory.createMany({
    data: [
      {
        tenantId: tenant.id,
        code: 'TRAVEL',
        name: 'Travel',
        description: 'Travel and commute expenses',
        capAmount: new Prisma.Decimal(5000),
        isActive: true,
      },
      {
        tenantId: tenant.id,
        code: 'MEAL',
        name: 'Meals',
        description: 'Business meal expenses',
        capAmount: new Prisma.Decimal(2500),
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  const travelCategory = await prisma.expenseCategory.findUnique({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'TRAVEL',
      },
    },
    select: { id: true },
  });

  if (travelCategory) {
    await prisma.expensePolicy.upsert({
      where: {
        tenantId_categoryId: {
          tenantId: tenant.id,
          categoryId: travelCategory.id,
        },
      },
      create: {
        tenantId: tenant.id,
        categoryId: travelCategory.id,
        categoryCap: new Prisma.Decimal(4500),
        requireApproval: true,
      },
      update: {
        categoryCap: new Prisma.Decimal(4500),
        requireApproval: true,
      },
    });
  }

  const superAdminRoleRecord = await prisma.role.findFirst({
    where: {
      tenantId: tenant.id,
      code: Role.SUPER_ADMIN,
    },
    select: { id: true },
  });

  if (!superAdminRoleRecord) {
    throw new Error('SUPER_ADMIN role missing after seed');
  }

  console.log('Seed complete');
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
