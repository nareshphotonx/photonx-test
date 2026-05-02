import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listRoles(tenantId: string): Promise<
    Array<{
      code: string;
      name: string;
      description: string | null;
      isSystem: boolean;
    }>
  > {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((role) => ({
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
    }));
  }

  async listPermissions(tenantId: string): Promise<
    Array<{
      code: string;
      name: string;
      description: string | null;
    }>
  > {
    const permissions = await this.prisma.permission.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return permissions.map((permission) => ({
      code: permission.code,
      name: permission.name,
      description: permission.description,
    }));
  }

  async assignUserRoles(
    tenantId: string,
    actorId: string,
    userId: string,
    roleCodes: string[],
  ): Promise<{ userId: string; roleCodes: string[] }> {
    const [user, roles] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          deletedAt: null,
        },
      }),
      this.prisma.role.findMany({
        where: {
          tenantId,
          code: {
            in: roleCodes,
          },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (roles.length !== roleCodes.length) {
      throw new NotFoundException('One or more roles not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          tenantId,
          userId,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          tenantId,
          userId,
          roleId: role.id,
        })),
      });
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'USER_ROLES_ASSIGN',
      entityType: 'User',
      entityId: userId,
      metadata: {
        roleCodes,
      },
    });

    return {
      userId,
      roleCodes,
    };
  }
}
