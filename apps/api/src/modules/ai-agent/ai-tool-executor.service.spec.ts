import { PERMISSIONS } from '../../common/constants/permission.constants';
import { Role } from '../../common/enums/role.enum';
import { AiToolExecutorService } from './ai-tool-executor.service';

describe('AiToolExecutorService scope enforcement', () => {
  const leaveService = { getBalance: jest.fn() } as any;
  const wfhService = {} as any;
  const tasksService = {} as any;
  const timeEntriesService = {} as any;
  const projectsService = {} as any;
  const approvalsService = {} as any;
  const expensesService = {} as any;
  const attendanceService = {} as any;
  const prisma = {} as any;

  const scopeService = {
    isEndUser: jest.fn(),
    isTeamLead: jest.fn(),
    getLeadTeamIds: jest.fn(),
  } as any;

  const service = new AiToolExecutorService(
    leaveService,
    wfhService,
    tasksService,
    timeEntriesService,
    projectsService,
    approvalsService,
    expensesService,
    attendanceService,
    prisma,
    scopeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    scopeService.isEndUser = jest.fn().mockReturnValue(true);
    scopeService.isTeamLead = jest.fn().mockReturnValue(false);
    scopeService.getLeadTeamIds = jest.fn().mockResolvedValue([]);
  });

  it('denies USER from requesting another user leave balance', async () => {
    const actor: Express.User = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      sessionId: 'session_1',
      roles: [Role.USER],
      permissions: [PERMISSIONS.AI_CHAT, PERMISSIONS.LEAVE_BALANCE_USER_READ],
    };

    const result = await service.execute('tenant_1', actor, 'get_user_leave_balance', {
      userId: 'user_2',
      year: 2026,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('own leave balance');
    expect(leaveService.getBalance).not.toHaveBeenCalled();
  });

  it('always passes tenant context into tool service calls', async () => {
    scopeService.isEndUser = jest.fn().mockReturnValue(false);

    leaveService.getBalance = jest.fn().mockResolvedValue({
      userId: 'user_1',
      year: 2026,
      total: 8,
    });

    const actor: Express.User = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      sessionId: 'session_1',
      roles: [Role.TEAM_LEAD],
      permissions: [PERMISSIONS.AI_CHAT, PERMISSIONS.LEAVE_BALANCE_ME_READ],
    };

    const result = await service.execute('tenant_abc', actor, 'get_user_leave_balance', {
      year: 2026,
    });

    expect(result.success).toBe(true);
    expect(leaveService.getBalance).toHaveBeenCalledWith('tenant_abc', actor, 'user_1', {
      year: 2026,
    });
  });

  it('requires tool-level permissions before execution', async () => {
    const actor: Express.User = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      sessionId: 'session_1',
      roles: [Role.USER],
      permissions: [PERMISSIONS.AI_CHAT],
    };

    const result = await service.execute('tenant_1', actor, 'get_user_leave_balance', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain(PERMISSIONS.LEAVE_BALANCE_ME_READ);
  });
});
