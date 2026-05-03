import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const requestContextService = {
    get: jest.fn(),
  } as any;

  const service = new AuditService(prisma, requestContextService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores request context metadata when logging', async () => {
    requestContextService.get.mockReturnValue({
      requestId: 'req_123',
      ipAddress: '127.0.0.1',
      userAgent: 'jest-agent',
    });

    prisma.auditLog.create.mockResolvedValue({
      id: 'audit_1',
    });

    await service.log({
      tenantId: 'tenant_1',
      actorId: 'user_1',
      action: 'USER_UPDATE',
      entityType: 'User',
      entityId: 'user_1',
      metadata: { field: 'name' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_1',
        actorId: 'user_1',
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: 'user_1',
        requestId: 'req_123',
        ipAddress: '127.0.0.1',
        userAgent: 'jest-agent',
      }),
    });
  });

  it('enforces tenant-scoped filtering in list query', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit_1' }]);
    prisma.$transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );

    const from = new Date('2026-05-01T00:00:00.000Z');
    const to = new Date('2026-05-31T23:59:59.000Z');

    const result = await service.listLogs('tenant_1', {
      page: 2,
      limit: 10,
      action: 'TASK_UPDATE',
      actorId: 'user_2',
      entityType: 'Task',
      entityId: 'task_1',
      from,
      to,
      search: 'TASK',
    });

    expect(result).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
    });

    const where = prisma.auditLog.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: 'tenant_1',
      action: 'TASK_UPDATE',
      actorId: 'user_2',
      entityType: 'Task',
      entityId: 'task_1',
    });
    expect(where.createdAt).toMatchObject({
      gte: from,
      lte: to,
    });
    expect(where.OR).toEqual([
      { action: { contains: 'TASK' } },
      { entityType: { contains: 'TASK' } },
      { entityId: { contains: 'TASK' } },
    ]);
  });
});

