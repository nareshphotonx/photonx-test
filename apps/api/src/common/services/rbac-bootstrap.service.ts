import { Injectable } from '@nestjs/common';
import { type Prisma, type PrismaClient } from '@prisma/client';
import {
  DEFAULT_PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSION_CODES,
} from '../constants/rbac.seed';

export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class RbacBootstrapService {
  async seedTenant(
    prisma: Prisma.TransactionClient | TxClient,
    tenantId: string,
  ): Promise<void> {
    await prisma.role.createMany({
      data: DEFAULT_ROLE_DEFINITIONS.map((entry) => ({
        tenantId,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        isSystem: true,
      })),
      skipDuplicates: true,
    });

    await prisma.permission.createMany({
      data: DEFAULT_PERMISSION_DEFINITIONS.map((entry) => ({
        tenantId,
        code: entry.code,
        name: entry.name,
        description: entry.description,
      })),
      skipDuplicates: true,
    });

    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({ where: { tenantId } }),
      prisma.permission.findMany({ where: { tenantId } }),
    ]);

    const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));
    const permissionIdByCode = new Map(
      permissions.map((permission) => [permission.code, permission.id]),
    );

    const rolePermissionRows: Array<{
      tenantId: string;
      roleId: string;
      permissionId: string;
    }> = [];

    for (const [roleCode, permissionCodes] of Object.entries(
      DEFAULT_ROLE_PERMISSION_CODES,
    )) {
      const roleId = roleIdByCode.get(roleCode);
      if (!roleId) {
        continue;
      }

      for (const permissionCode of permissionCodes) {
        const permissionId = permissionIdByCode.get(permissionCode);

        if (!permissionId) {
          continue;
        }

        rolePermissionRows.push({
          tenantId,
          roleId,
          permissionId,
        });
      }
    }

    if (rolePermissionRows.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePermissionRows,
        skipDuplicates: true,
      });
    }
  }
}
