import { OfficePolicyService } from './office-policy.service';

describe('OfficePolicyService', () => {
  const prisma = {
    officeLocation: { create: jest.fn(), findMany: jest.fn() },
    officeIp: { create: jest.fn(), findMany: jest.fn() },
  } as any;

  const audit = {
    log: jest.fn(),
  } as any;

  const service = new OfficePolicyService(prisma, audit);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows matching CIDR rule', async () => {
    prisma.officeIp.findMany = jest.fn().mockResolvedValue([
      { cidr: '203.0.113.0/24', isActive: true },
    ]);

    const result = await service.checkPolicy('tenant_1', '203.0.113.10', {});

    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe('203.0.113.0/24');
  });

  it('denies unmatched CIDR rule', async () => {
    prisma.officeIp.findMany = jest.fn().mockResolvedValue([
      { cidr: '203.0.113.0/24', isActive: true },
    ]);

    const result = await service.checkPolicy('tenant_1', '198.51.100.10', {});

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBeNull();
  });
});
