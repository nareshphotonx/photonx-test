import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const prisma = {
    tenantSetting: { findUnique: jest.fn() },
    officeIp: { findMany: jest.fn() },
    officeLocation: { findMany: jest.fn() },
    attendanceDay: { upsert: jest.fn() },
    attendanceEvent: { create: jest.fn() },
    teamMember: { findMany: jest.fn() },
  } as any;

  const auditService = {
    log: jest.fn(),
  } as any;

  const approvalsService = {} as any;
  const requestCodeService = {
    next: jest.fn().mockResolvedValue(1),
  } as any;

  const service = new AttendanceService(
    prisma,
    auditService,
    approvalsService,
    requestCodeService,
  );

  const actor: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: ['USER'],
    permissions: ['attendance:check_in'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.tenantSetting.findUnique.mockResolvedValue({
      extras: {
        officeStartTime: '09:30',
        officeEndTime: '18:30',
        officeGeoFenceMeters: 150,
      },
    });
    prisma.officeIp.findMany.mockResolvedValue([{ cidr: '203.0.113.0/24' }]);
    prisma.officeLocation.findMany.mockResolvedValue([]);
    prisma.attendanceDay.upsert.mockResolvedValue({
      id: 'day_1',
      isMissingCheckout: true,
    });
    prisma.attendanceEvent.create.mockResolvedValue({
      id: 'event_1',
    });
  });

  it('calculates late minutes from tenant officeStartTime on check-in', async () => {
    await service.checkIn('tenant_1', actor, '203.0.113.10', {
      occurredAt: new Date('2026-06-01T09:45:00.000Z'),
      latitude: 12.97,
      longitude: 77.59,
    });

    const call = prisma.attendanceDay.upsert.mock.calls[0][0];
    expect(call.create.lateMinutes).toBe(15);
    expect(call.create.isOffice).toBe(true);
    expect(call.create.nonOfficeReason).toBeNull();
  });
});
