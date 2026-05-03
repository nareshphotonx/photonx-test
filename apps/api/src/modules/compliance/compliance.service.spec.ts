import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ComplianceRequestStatus, ComplianceRequestType } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { ComplianceService } from './compliance.service';

describe('ComplianceService', () => {
  const prisma = {
    complianceRequest: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = {
    log: jest.fn(),
  } as any;

  const secretCryptoService = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
  } as any;

  const queue = {
    add: jest.fn(),
  } as any;

  const service = new ComplianceService(
    prisma,
    auditService,
    secretCryptoService,
    queue,
  );

  const endUser: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: [Role.USER],
    permissions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );
  });

  it('creates self-service export request and enqueues processing job', async () => {
    prisma.complianceRequest.create.mockResolvedValue({
      id: 'req_1',
      tenantId: 'tenant_1',
      requestedById: 'user_1',
      targetUserId: 'user_1',
      type: ComplianceRequestType.DATA_EXPORT,
      status: ComplianceRequestStatus.PENDING,
    });

    const result = await service.createDataExportRequest('tenant_1', endUser, {
      reason: 'Personal archive',
      format: 'json',
    });

    expect(result.id).toBe('req_1');
    expect(prisma.complianceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant_1',
        requestedById: 'user_1',
        targetUserId: 'user_1',
        type: ComplianceRequestType.DATA_EXPORT,
        status: ComplianceRequestStatus.PENDING,
      }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'compliance-request',
      { requestId: 'req_1' },
      expect.any(Object),
    );
  });

  it('requires confirmation for erasure request', async () => {
    await expect(
      service.createDataErasureRequest('tenant_1', endUser, {
        reason: 'Delete my data',
        confirm: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.complianceRequest.create).not.toHaveBeenCalled();
  });

  it('prevents non-super-admin users from querying another user requests', async () => {
    await expect(
      service.listRequests('tenant_1', endUser, {
        userId: 'user_2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes list query to actor for end users', async () => {
    prisma.complianceRequest.count.mockResolvedValue(1);
    prisma.complianceRequest.findMany.mockResolvedValue([
      {
        id: 'req_1',
        targetUserId: 'user_1',
      },
    ]);

    const result = await service.listRequests('tenant_1', endUser, {
      page: 1,
      limit: 20,
      type: ComplianceRequestType.DATA_EXPORT,
    });

    expect(result.total).toBe(1);

    const where = prisma.complianceRequest.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: 'tenant_1',
      targetUserId: 'user_1',
      type: ComplianceRequestType.DATA_EXPORT,
    });
  });
});

