import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type LoginDto } from './dto/login.dto';
import { type RefreshDto } from './dto/refresh.dto';
import { type LogoutDto } from './dto/logout.dto';
import { type JwtPayload } from './interfaces/jwt-payload.interface';
import { type AuthTokens } from './types/auth-tokens.type';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../../common/security/token.util';
import { verifyPassword } from '../../common/security/password.util';
import { AuditService } from '../audit/audit.service';

interface AuthRequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface UserAccessContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, meta: AuthRequestMeta): Promise<AuthTokens> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        isActive: true,
        ...(dto.email ? { email: dto.email } : { phone: dto.phone }),
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await verifyPassword(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const access = await this.resolveUserAccess(user.id, tenant.id);
    const tokens = await this.createAuthTokens(access, meta);

    await this.auditService.log({
      tenantId: tenant.id,
      actorId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'AuthSession',
      metadata: {
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return tokens;
  }

  async refresh(dto: RefreshDto, meta: AuthRequestMeta): Promise<AuthTokens> {
    const refreshTokenHash = hashRefreshToken(dto.refreshToken);

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: {
        user: true,
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const access = await this.resolveUserAccess(session.userId, session.tenantId);
    const tokens = await this.rotateSessionAndIssueTokens(session.id, access, meta);

    await this.auditService.log({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: 'AUTH_REFRESH',
      entityType: 'AuthSession',
      entityId: session.id,
      metadata: {
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return tokens;
  }

  async logout(
    dto: LogoutDto,
    authUser: Express.User,
  ): Promise<{ revoked: boolean }> {
    const refreshTokenHash = hashRefreshToken(dto.refreshToken);

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: authUser.sessionId,
        tenantId: authUser.tenantId,
        userId: authUser.sub,
        refreshTokenHash,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token for session');
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      tenantId: authUser.tenantId,
      actorId: authUser.sub,
      action: 'AUTH_LOGOUT',
      entityType: 'AuthSession',
      entityId: session.id,
    });

    return { revoked: true };
  }

  async me(authUser: Express.User): Promise<{
    id: string;
    tenantId: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
  }> {
    const access = await this.resolveUserAccess(authUser.sub, authUser.tenantId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: authUser.sub,
        tenantId: authUser.tenantId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  async hashPassword(plain: string): Promise<string> {
    if (plain.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const { hashPassword } = await import('../../common/security/password.util');
    return hashPassword(plain);
  }

  private async resolveUserAccess(
    userId: string,
    tenantId: string,
  ): Promise<UserAccessContext> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        userRoles: {
          where: { tenantId },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found for access');
    }

    const roles = user.userRoles.map((entry) => entry.role.code);

    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((entry) =>
          entry.role.permissions.map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    );

    return {
      userId,
      tenantId,
      roles,
      permissions,
    };
  }

  private async createAuthTokens(
    access: UserAccessContext,
    meta: AuthRequestMeta,
  ): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const sessionExpiryDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS', '30'),
    );

    const expiresAt = new Date(Date.now() + sessionExpiryDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.authSession.create({
      data: {
        tenantId: access.tenantId,
        userId: access.userId,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    const accessToken = await this.signAccessToken({
      sub: access.userId,
      tenantId: access.tenantId,
      sessionId: session.id,
      roles: access.roles,
      permissions: access.permissions,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
    };
  }

  private async rotateSessionAndIssueTokens(
    sessionId: string,
    access: UserAccessContext,
    meta: AuthRequestMeta,
  ): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const sessionExpiryDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS', '30'),
    );

    const expiresAt = new Date(Date.now() + sessionExpiryDays * 24 * 60 * 60 * 1000);

    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    const accessToken = await this.signAccessToken({
      sub: access.userId,
      tenantId: access.tenantId,
      sessionId,
      roles: access.roles,
      permissions: access.permissions,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
    };
  }

  private signAccessToken(payload: JwtPayload): Promise<string> {
    const expiresIn = this.parseJwtExpiresInToSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
    );

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET', 'change-this-secret'),
      expiresIn,
    });
  }

  private parseJwtExpiresInToSeconds(raw: string): number {
    const value = raw.trim().toLowerCase();

    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    const numericPart = Number(value.slice(0, -1));
    const unit = value.slice(-1);

    if (!Number.isFinite(numericPart) || numericPart <= 0) {
      return 86400;
    }

    switch (unit) {
      case 'd':
        return numericPart * 24 * 60 * 60;
      case 'h':
        return numericPart * 60 * 60;
      case 'm':
        return numericPart * 60;
      case 's':
        return numericPart;
      default:
        return 86400;
    }
  }
}
