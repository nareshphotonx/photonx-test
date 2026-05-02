import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkWeekStart } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RbacBootstrapService } from '../../common/services/rbac-bootstrap.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { type CreateTenantDto } from './dto/create-tenant.dto';
import { type UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacBootstrap: RbacBootstrapService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async createTenant(dto: CreateTenantDto): Promise<{
    tenantId: string;
    tenantSlug: string;
    ownerUserId: string;
  }> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name,
            slug: dto.slug,
          },
        });

        await tx.tenantSetting.create({
          data: {
            tenantId: tenant.id,
            timezone: dto.timezone ?? 'Asia/Kolkata',
            currency: dto.currency ?? 'INR',
            workWeekStart: dto.workWeekStart ?? WorkWeekStart.MONDAY,
            extras: dto.extras as Prisma.InputJsonValue | undefined,
          },
        });

        await this.rbacBootstrap.seedTenant(tx, tenant.id);

        const superAdminRole = await tx.role.findUnique({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code: Role.SUPER_ADMIN,
            },
          },
        });

        if (!superAdminRole) {
          throw new NotFoundException('SUPER_ADMIN role not seeded');
        }

        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.ownerName,
            email: dto.email,
            phone: dto.phone,
            passwordHash: await this.authService.hashPassword(dto.password),
          },
        });

        await tx.userRole.create({
          data: {
            tenantId: tenant.id,
            userId: owner.id,
            roleId: superAdminRole.id,
          },
        });

        await tx.notificationPreference.create({
          data: {
            tenantId: tenant.id,
            userId: owner.id,
          },
        });

        return {
          tenant,
          owner,
        };
      });

      await this.auditService.log({
        tenantId: created.tenant.id,
        actorId: created.owner.id,
        action: 'TENANT_CREATE',
        entityType: 'Tenant',
        entityId: created.tenant.id,
      });

      return {
        tenantId: created.tenant.id,
        tenantSlug: created.tenant.slug,
        ownerUserId: created.owner.id,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tenant slug or owner identifier already exists');
      }

      throw error;
    }
  }

  async getCurrentTenant(tenantId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    settings: {
      timezone: string;
      currency: string;
      workWeekStart: WorkWeekStart;
      extras: Prisma.JsonValue | null;
    } | null;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isActive: tenant.isActive,
      settings: tenant.settings
        ? {
            timezone: tenant.settings.timezone,
            currency: tenant.settings.currency,
            workWeekStart: tenant.settings.workWeekStart,
            extras: tenant.settings.extras,
          }
        : null,
    };
  }

  async updateCurrentSettings(
    tenantId: string,
    actorId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<{
    tenantId: string;
    timezone: string;
    currency: string;
    workWeekStart: WorkWeekStart;
    extras: Prisma.JsonValue | null;
  }> {
    const settings = await this.prisma.tenantSetting.upsert({
      where: { tenantId },
      update: {
        timezone: dto.timezone,
        currency: dto.currency,
        workWeekStart: dto.workWeekStart,
        extras: dto.extras as Prisma.InputJsonValue | undefined,
      },
      create: {
        tenantId,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        currency: dto.currency ?? 'INR',
        workWeekStart: dto.workWeekStart ?? WorkWeekStart.MONDAY,
        extras: dto.extras as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'TENANT_SETTINGS_UPDATE',
      entityType: 'TenantSetting',
      entityId: settings.id,
      metadata: dto as Record<string, unknown>,
    });

    return {
      tenantId,
      timezone: settings.timezone,
      currency: settings.currency,
      workWeekStart: settings.workWeekStart,
      extras: settings.extras,
    };
  }
}
