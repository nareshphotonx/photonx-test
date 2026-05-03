import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplianceRequestStatus,
  ComplianceRequestType,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SecretCryptoService } from '../../common/security/secret-crypto.service';
import { AuditService } from '../audit/audit.service';
import { CreateDataErasureRequestDto } from './dto/create-data-erasure-request.dto';
import { CreateDataExportRequestDto } from './dto/create-data-export-request.dto';
import { ListComplianceRequestsDto } from './dto/list-compliance-requests.dto';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly secretCryptoService: SecretCryptoService,
    @InjectQueue('compliance-requests')
    private readonly complianceQueue: Queue,
  ) {}

  async createDataExportRequest(
    tenantId: string,
    actor: Express.User,
    dto: CreateDataExportRequestDto,
  ) {
    const request = await this.prisma.complianceRequest.create({
      data: {
        tenantId,
        requestedById: actor.sub,
        targetUserId: actor.sub,
        type: ComplianceRequestType.DATA_EXPORT,
        status: ComplianceRequestStatus.PENDING,
        reason: dto.reason,
        requestMeta: {
          format: dto.format ?? 'json',
        } as Prisma.InputJsonValue,
      },
    });

    await this.enqueueComplianceRequest(request.id);

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'COMPLIANCE_EXPORT_REQUEST_CREATE',
      entityType: 'ComplianceRequest',
      entityId: request.id,
      metadata: {
        type: request.type,
      },
    });

    return request;
  }

  async createDataErasureRequest(
    tenantId: string,
    actor: Express.User,
    dto: CreateDataErasureRequestDto,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException('Erasure confirmation must be true');
    }

    const request = await this.prisma.complianceRequest.create({
      data: {
        tenantId,
        requestedById: actor.sub,
        targetUserId: actor.sub,
        type: ComplianceRequestType.DATA_ERASURE,
        status: ComplianceRequestStatus.PENDING,
        reason: dto.reason,
        requestMeta: {
          confirm: dto.confirm,
        } as Prisma.InputJsonValue,
      },
    });

    await this.enqueueComplianceRequest(request.id);

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'COMPLIANCE_ERASURE_REQUEST_CREATE',
      entityType: 'ComplianceRequest',
      entityId: request.id,
      metadata: {
        type: request.type,
      },
    });

    return request;
  }

  async listRequests(
    tenantId: string,
    actor: Express.User,
    query: ListComplianceRequestsDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const isSuperAdmin = this.isSuperAdmin(actor);

    if (!isSuperAdmin && query.userId && query.userId !== actor.sub) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can filter by userId for compliance requests',
      );
    }

    const where: Prisma.ComplianceRequestWhereInput = {
      tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      ...(isSuperAdmin
        ? query.userId
          ? { targetUserId: query.userId }
          : {}
        : { targetUserId: actor.sub }),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.complianceRequest.count({ where }),
      this.prisma.complianceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async processRequest(requestId: string): Promise<void> {
    const request = await this.prisma.complianceRequest.findUnique({
      where: { id: requestId },
      include: {
        targetUser: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            isActive: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Compliance request not found');
    }

    if (
      request.status === ComplianceRequestStatus.COMPLETED ||
      request.status === ComplianceRequestStatus.IN_PROGRESS
    ) {
      return;
    }

    await this.prisma.complianceRequest.update({
      where: { id: request.id },
      data: {
        status: ComplianceRequestStatus.IN_PROGRESS,
      },
    });

    await this.auditService.log({
      tenantId: request.tenantId,
      actorId: request.requestedById,
      action: 'COMPLIANCE_REQUEST_PROCESS_START',
      entityType: 'ComplianceRequest',
      entityId: request.id,
      metadata: {
        type: request.type,
      },
    });

    try {
      if (request.type === ComplianceRequestType.DATA_EXPORT) {
        await this.processDataExport(request.id, request.tenantId, request.targetUserId);
      } else {
        await this.processDataErasure(request.id, request.tenantId, request.targetUserId);
      }

      await this.auditService.log({
        tenantId: request.tenantId,
        actorId: request.requestedById,
        action: 'COMPLIANCE_REQUEST_PROCESS_COMPLETE',
        entityType: 'ComplianceRequest',
        entityId: request.id,
        metadata: {
          type: request.type,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Compliance processing failed';
      this.logger.error(`Compliance request failed: ${request.id}`, error as Error);

      await this.prisma.complianceRequest.update({
        where: { id: request.id },
        data: {
          status: ComplianceRequestStatus.FAILED,
          failureReason: message,
          processedAt: new Date(),
        },
      });

      await this.auditService.log({
        tenantId: request.tenantId,
        actorId: request.requestedById,
        action: 'COMPLIANCE_REQUEST_PROCESS_FAILED',
        entityType: 'ComplianceRequest',
        entityId: request.id,
        metadata: {
          type: request.type,
          failureReason: message,
        },
      });
    }
  }

  private async processDataExport(
    requestId: string,
    tenantId: string,
    targetUserId: string,
  ) {
    const [
      user,
      teams,
      roles,
      timeEntries,
      leaveRequests,
      wfhRequests,
      expenses,
      attendanceDays,
    ] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          tenantId,
          id: targetUserId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.userRole.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        include: {
          role: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.wfhRequest.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.expense.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.attendanceDay.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        orderBy: { date: 'desc' },
        take: 365,
      }),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      user,
      teams: teams.map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.team.name,
        joinedAt: entry.createdAt,
      })),
      roles: roles.map((entry) => ({
        roleCode: entry.role.code,
        roleName: entry.role.name,
        assignedAt: entry.createdAt,
      })),
      timeEntries,
      leaveRequests,
      wfhRequests,
      expenses,
      attendanceDays,
    };

    const json = JSON.stringify(payload);
    const encryptedPayload = this.secretCryptoService.encrypt(json);
    const retentionDays = Number(process.env.COMPLIANCE_EXPORT_RETENTION_DAYS ?? '7');

    await this.prisma.complianceRequest.update({
      where: { id: requestId },
      data: {
        status: ComplianceRequestStatus.COMPLETED,
        encryptedPayload,
        resultMeta: {
          format: 'json',
          payloadSize: Buffer.byteLength(json, 'utf8'),
          retentionDays,
          recordCounts: {
            teams: teams.length,
            roles: roles.length,
            timeEntries: timeEntries.length,
            leaveRequests: leaveRequests.length,
            wfhRequests: wfhRequests.length,
            expenses: expenses.length,
            attendanceDays: attendanceDays.length,
          },
        } as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
  }

  private async processDataErasure(
    requestId: string,
    tenantId: string,
    targetUserId: string,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: targetUserId,
      },
      select: {
        id: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found for erasure');
    }

    const anonymizedName = this.buildAnonymizedName(targetUser.id);
    const anonymizedPhone = this.buildAnonymizedPhone(targetUser.id);
    const anonymizedEmail = this.buildAnonymizedEmail(targetUser.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.deleteMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
      });

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          name: anonymizedName,
          email: anonymizedEmail,
          phone: anonymizedPhone,
          isActive: false,
          deletedAt: new Date(),
          deletedBy: 'COMPLIANCE_ERASURE',
        },
      });

      await tx.whatsAppSession.updateMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        data: {
          waUserPhone: anonymizedPhone,
        },
      });

      await tx.whatsAppMessage.updateMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        data: {
          waUserPhone: anonymizedPhone,
        },
      });

      await tx.gitHubIdentityMap.updateMany({
        where: {
          tenantId,
          userId: targetUserId,
          kind: 'EMAIL',
        },
        data: {
          value: `erased_${targetUser.id}@redacted.local`,
          isActive: false,
        },
      });

      await tx.gitHubIdentityMap.updateMany({
        where: {
          tenantId,
          userId: targetUserId,
          kind: 'USERNAME',
        },
        data: {
          value: `erased_${targetUser.id}`,
          isActive: false,
        },
      });

      await tx.complianceRequest.update({
        where: { id: requestId },
        data: {
          status: ComplianceRequestStatus.COMPLETED,
          resultMeta: {
            anonymizedFields: ['name', 'email', 'phone'],
            sessionsRevoked: true,
          } as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
      });
    });
  }

  private async enqueueComplianceRequest(requestId: string): Promise<void> {
    await this.complianceQueue.add(
      'compliance-request',
      { requestId },
      {
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return (actor.roles ?? []).includes(Role.SUPER_ADMIN);
  }

  private buildAnonymizedName(userId: string): string {
    return `Erased User ${userId.slice(-6).toUpperCase()}`;
  }

  private buildAnonymizedEmail(userId: string): string {
    return `erased_${userId}@redacted.local`;
  }

  private buildAnonymizedPhone(userId: string): string {
    const cleaned = userId.replace(/[^0-9]/g, '');
    const suffix = cleaned.slice(-8).padStart(8, '0');
    return `+99999${suffix}`;
  }
}
