import { ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, ApprovalTargetType } from '@prisma/client';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsService', () => {
  const prisma = {
    approvalRequest: { findFirst: jest.fn() },
  } as any;

  const auditService = { log: jest.fn() } as any;
  const service = new ApprovalsService(prisma, auditService);

  const actor: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: ['TEAM_LEAD'],
    permissions: ['approvals:approve'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval_1',
      tenantId: 'tenant_1',
      requesterId: 'user_1',
      targetType: ApprovalTargetType.LEAVE_REQUEST,
      targetId: 'leave_req_1',
      status: ApprovalStatus.PENDING,
      steps: [
        {
          id: 'step_1',
          stepOrder: 1,
          approverId: 'lead_1',
          status: ApprovalStatus.PENDING,
        },
      ],
    });
  });

  it('rejects self approval', async () => {
    await expect(
      service.approve('tenant_1', actor, 'approval_1', { reason: 'ok' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
