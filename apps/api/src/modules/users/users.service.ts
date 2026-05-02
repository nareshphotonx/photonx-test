import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { type CreateUserDto } from './dto/create-user.dto';
import { type ImportUsersDto } from './dto/import-users.dto';
import { type ListUsersDto } from './dto/list-users.dto';
import { type UpdateUserDto } from './dto/update-user.dto';

export interface UserListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  roles: string[];
  teamIds: string[];
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async createUser(
    tenantId: string,
    actorId: string,
    dto: CreateUserDto,
  ): Promise<UserListItem> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            passwordHash: await this.authService.hashPassword(dto.password),
            isActive: dto.isActive ?? true,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
            teamMembership: true,
          },
        });

        await tx.notificationPreference.create({
          data: {
            tenantId,
            userId: user.id,
          },
        });

        return user;
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: created.id,
        metadata: {
          email: created.email,
          phone: created.phone,
        },
      });

      return {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        isActive: created.isActive,
        roles: created.userRoles.map((entry) => entry.role.code),
        teamIds: created.teamMembership.map((entry) => entry.teamId),
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User email or phone already exists in tenant');
      }

      throw error;
    }
  }

  async listUsers(
    tenantId: string,
    query: ListUsersDto,
  ): Promise<{
    items: UserListItem[];
    page: number;
    limit: number;
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { email: { contains: query.search } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.teamId
        ? {
            teamMembership: {
              some: {
                tenantId,
                teamId: query.teamId,
              },
            },
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: { include: { role: true } },
          teamMembership: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        roles: user.userRoles.map((entry) => entry.role.code),
        teamIds: user.teamMembership.map((entry) => entry.teamId),
        createdAt: user.createdAt,
      })),
      page,
      limit,
      total,
    };
  }

  async getUserById(tenantId: string, userId: string): Promise<UserListItem> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
      },
      include: {
        userRoles: { include: { role: true } },
        teamMembership: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      roles: user.userRoles.map((entry) => entry.role.code),
      teamIds: user.teamMembership.map((entry) => entry.teamId),
      createdAt: user.createdAt,
    };
  }

  async updateUser(
    tenantId: string,
    actorId: string,
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserListItem> {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const nextEmail = dto.email === null ? null : dto.email ?? existing.email;
    const nextPhone = dto.phone === null ? null : dto.phone ?? existing.phone;

    if (!nextEmail && !nextPhone) {
      throw new BadRequestException('User must have at least email or phone');
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          email: nextEmail,
          phone: nextPhone,
          isActive: dto.isActive,
          ...(dto.password
            ? {
                passwordHash: await this.authService.hashPassword(dto.password),
              }
            : {}),
        },
        include: {
          userRoles: { include: { role: true } },
          teamMembership: true,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: updated.id,
        metadata: dto as Record<string, unknown>,
      });

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        isActive: updated.isActive,
        roles: updated.userRoles.map((entry) => entry.role.code),
        teamIds: updated.teamMembership.map((entry) => entry.teamId),
        createdAt: updated.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User email or phone already exists in tenant');
      }

      throw error;
    }
  }

  async deleteUser(
    tenantId: string,
    actorId: string,
    userId: string,
  ): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
        isActive: false,
        email: null,
        phone: null,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'USER_DELETE',
      entityType: 'User',
      entityId: existing.id,
    });

    return { deleted: true };
  }

  async importUsers(
    tenantId: string,
    actorId: string,
    dto: ImportUsersDto,
  ): Promise<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ index: number; reason: string }>;
  }> {
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (const [index, row] of dto.users.entries()) {
      try {
        const existing = await this.prisma.user.findFirst({
          where: {
            tenantId,
            ...(row.email ? { email: row.email } : { phone: row.phone }),
          },
        });

        if (existing) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              email: row.email ?? existing.email,
              phone: row.phone ?? existing.phone,
              passwordHash: await this.authService.hashPassword(row.password),
              deletedAt: null,
              deletedBy: null,
              isActive: true,
            },
          });

          updated += 1;
        } else {
          const newUser = await this.prisma.user.create({
            data: {
              tenantId,
              name: row.name,
              email: row.email,
              phone: row.phone,
              passwordHash: await this.authService.hashPassword(row.password),
            },
          });

          await this.prisma.notificationPreference.create({
            data: {
              tenantId,
              userId: newUser.id,
            },
          });

          created += 1;
        }
      } catch (error) {
        failed += 1;
        errors.push({
          index,
          reason:
            error instanceof Error ? error.message : 'Unknown import processing error',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'USER_IMPORT',
      entityType: 'User',
      metadata: {
        total: dto.users.length,
        created,
        updated,
        failed,
      },
    });

    return {
      total: dto.users.length,
      created,
      updated,
      failed,
      errors,
    };
  }
}
