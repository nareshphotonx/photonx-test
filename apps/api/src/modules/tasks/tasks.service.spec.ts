import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService RBAC', () => {
  const prisma = {} as any;
  const scopeService = {
    ensureTaskManageAccess: jest.fn(),
    isEndUser: jest.fn(),
  } as any;
  const auditService = {
    log: jest.fn(),
  } as any;
  const dependencyService = {
    wouldCreateCycle: jest.fn(),
  } as any;
  const queue = {
    add: jest.fn(),
  } as any;

  const service = new TasksService(
    prisma,
    scopeService,
    auditService,
    dependencyService,
    queue,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks USER from patching restricted fields', async () => {
    scopeService.ensureTaskManageAccess = jest.fn().mockResolvedValue({
      id: 'task_1',
      projectId: 'project_1',
      taskStatusId: 'status_1',
      status: {
        isDone: false,
      },
    });
    scopeService.isEndUser = jest.fn().mockReturnValue(true);

    await expect(
      service.updateTask(
        'tenant_1',
        {
          sub: 'user_1',
          tenantId: 'tenant_1',
          roles: ['USER'],
          permissions: ['tasks:update'],
          sessionId: 'session_1',
        },
        'task_1',
        {
          title: 'Not allowed for USER',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
