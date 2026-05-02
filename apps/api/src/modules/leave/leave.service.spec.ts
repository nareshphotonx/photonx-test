import { LeaveService } from './leave.service';

describe('LeaveService', () => {
  const prisma = {
    leaveType: { findMany: jest.fn() },
    leaveAccrualLedger: { aggregate: jest.fn() },
    leaveRequest: { aggregate: jest.fn() },
  } as any;

  const auditService = { log: jest.fn() } as any;
  const approvalsService = {} as any;

  const service = new LeaveService(prisma, auditService, approvalsService);

  const actor: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: ['USER'],
    permissions: ['leave_balance:me:read'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest
      .spyOn(service as any, 'ensureAccrualLedgerForYear')
      .mockResolvedValue(undefined);

    prisma.leaveType.findMany.mockResolvedValue([
      {
        id: 'leave_type_1',
        code: 'CASUAL',
        name: 'Casual Leave',
        policies: [
          {
            id: 'policy_1',
            defaultAnnualQuota: 18,
            monthlyAccrual: 1.5,
            joiningProration: true,
          },
        ],
        overrides: [
          {
            id: 'override_1',
            annualQuota: 20,
            monthlyAccrual: 2,
          },
        ],
      },
    ]);

    prisma.leaveAccrualLedger.aggregate.mockResolvedValue({
      _sum: { amount: 12 },
    });

    prisma.leaveRequest.aggregate
      .mockResolvedValueOnce({ _sum: { totalDays: 4 } })
      .mockResolvedValueOnce({ _sum: { totalDays: 2 } });
  });

  it('computes leave balance with accrued, approved, and pending usage', async () => {
    const result = await service.getMyBalance('tenant_1', actor, { year: 2026 });

    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]).toMatchObject({
      annualQuota: 20,
      accrued: 12,
      usedApproved: 4,
      usedPending: 2,
      available: 8,
    });
  });
});
