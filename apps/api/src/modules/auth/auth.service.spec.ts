import { UnauthorizedException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    tenant: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  } as any;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback: string) => {
      if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') {
        return '30';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '1d';
      }
      if (key === 'JWT_SECRET') {
        return 'secret';
      }
      return fallback;
    }),
  } as any;

  const auditService = {
    log: jest.fn(),
  } as any;

  const service = new AuthService(prisma, jwtService, configService, auditService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs in with email and returns token pair', async () => {
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: 'tenant_1',
      isActive: true,
    });

    prisma.user.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'user_1',
        passwordHash: hashSync('password123', 10),
      })
      .mockResolvedValueOnce({
        id: 'user_1',
        tenantId: 'tenant_1',
        deletedAt: null,
        isActive: true,
        userRoles: [],
      });

    prisma.authSession.create = jest.fn().mockResolvedValue({ id: 'session_1' });

    const tokens = await service.login(
      {
        tenantSlug: 'tenant',
        email: 'a@b.com',
        password: 'password123',
        identifierRule: 'ok',
      },
      {},
    );

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toBeDefined();
    expect(auditService.log).toHaveBeenCalled();
  });

  it('throws unauthorized for missing tenant', async () => {
    prisma.tenant.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.login(
        {
          tenantSlug: 'missing',
          email: 'a@b.com',
          password: 'password123',
          identifierRule: 'ok',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
