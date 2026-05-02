import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ApprovalTargetType,
  AttendanceDayStatus,
  AttendanceEventType,
  Prisma,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestCodeService } from '../../common/services/request-code.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { ListRegularizationDto } from './dto/list-regularization.dto';
import { RegularizationActionDto } from './dto/regularization-action.dto';

interface OfficePolicy {
  officeStartTime: string;
  officeEndTime: string;
  officeGeoFenceMeters: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalsService: ApprovalsService,
    private readonly requestCodeService: RequestCodeService,
  ) {}

  async checkIn(
    tenantId: string,
    actor: Express.User,
    requestIp: string | undefined,
    dto: CheckInDto,
  ) {
    const occurredAt = dto.occurredAt ?? new Date();
    const date = this.normalizeDateOnly(occurredAt);

    const policy = await this.getOfficePolicy(tenantId);
    const officeStatus = await this.resolveOfficeStatus(
      tenantId,
      requestIp,
      dto.latitude,
      dto.longitude,
      policy.officeGeoFenceMeters,
    );

    if (!officeStatus.isOffice && !dto.reason) {
      throw new BadRequestException('Reason is required for non-office check-in');
    }

    const lateMinutes = this.calculateLateMinutes(occurredAt, policy.officeStartTime);

    const attendanceDay = await this.prisma.attendanceDay.upsert({
      where: {
        tenantId_userId_date: {
          tenantId,
          userId: actor.sub,
          date,
        },
      },
      create: {
        tenantId,
        userId: actor.sub,
        officeLocationId: officeStatus.locationId,
        date,
        checkInAt: occurredAt,
        checkInIp: this.normalizeIp(requestIp),
        checkInLatitude: dto.latitude,
        checkInLongitude: dto.longitude,
        isOffice: officeStatus.isOffice,
        nonOfficeReason: officeStatus.isOffice ? null : dto.reason,
        lateMinutes,
        isMissingCheckout: true,
        status: AttendanceDayStatus.OPEN,
      },
      update: {
        officeLocationId: officeStatus.locationId,
        checkInAt: occurredAt,
        checkInIp: this.normalizeIp(requestIp),
        checkInLatitude: dto.latitude,
        checkInLongitude: dto.longitude,
        isOffice: officeStatus.isOffice,
        nonOfficeReason: officeStatus.isOffice ? null : dto.reason,
        lateMinutes,
        isMissingCheckout: true,
        status: AttendanceDayStatus.OPEN,
      },
    });

    const event = await this.prisma.attendanceEvent.create({
      data: {
        tenantId,
        userId: actor.sub,
        attendanceDayId: attendanceDay.id,
        type: AttendanceEventType.CHECK_IN,
        occurredAt,
        ipAddress: this.normalizeIp(requestIp),
        latitude: dto.latitude,
        longitude: dto.longitude,
        isOffice: officeStatus.isOffice,
        reason: officeStatus.isOffice ? null : dto.reason,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'AttendanceDay',
      entityId: attendanceDay.id,
      metadata: {
        eventId: event.id,
        isOffice: officeStatus.isOffice,
      },
    });

    return {
      attendanceDay,
      event,
      missingCheckout: attendanceDay.isMissingCheckout,
    };
  }

  async checkOut(
    tenantId: string,
    actor: Express.User,
    requestIp: string | undefined,
    dto: CheckOutDto,
  ) {
    const occurredAt = dto.occurredAt ?? new Date();
    const date = this.normalizeDateOnly(occurredAt);

    const attendanceDay = await this.prisma.attendanceDay.findUnique({
      where: {
        tenantId_userId_date: {
          tenantId,
          userId: actor.sub,
          date,
        },
      },
    });

    if (!attendanceDay || !attendanceDay.checkInAt) {
      throw new NotFoundException('No check-in found for current day');
    }

    const policy = await this.getOfficePolicy(tenantId);
    const earlyLogoutMinutes = this.calculateEarlyLogoutMinutes(
      occurredAt,
      policy.officeEndTime,
    );

    const updatedDay = await this.prisma.attendanceDay.update({
      where: { id: attendanceDay.id },
      data: {
        checkOutAt: occurredAt,
        checkOutIp: this.normalizeIp(requestIp),
        checkOutLatitude: dto.latitude,
        checkOutLongitude: dto.longitude,
        earlyLogoutMinutes,
        isMissingCheckout: false,
        status: AttendanceDayStatus.COMPLETE,
      },
    });

    const event = await this.prisma.attendanceEvent.create({
      data: {
        tenantId,
        userId: actor.sub,
        attendanceDayId: attendanceDay.id,
        type: AttendanceEventType.CHECK_OUT,
        occurredAt,
        ipAddress: this.normalizeIp(requestIp),
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'AttendanceDay',
      entityId: attendanceDay.id,
      metadata: {
        eventId: event.id,
      },
    });

    return {
      attendanceDay: updatedDay,
      event,
      missingCheckout: updatedDay.isMissingCheckout,
    };
  }

  async getToday(tenantId: string, actor: Express.User) {
    const date = this.normalizeDateOnly(new Date());

    const today = await this.prisma.attendanceDay.findUnique({
      where: {
        tenantId_userId_date: {
          tenantId,
          userId: actor.sub,
          date,
        },
      },
      include: {
        events: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    return {
      date,
      attendance: today,
      missingCheckout: today?.isMissingCheckout ?? false,
    };
  }

  async getReport(tenantId: string, actor: Express.User, query: AttendanceReportDto) {
    const where: Prisma.AttendanceDayWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              gte: query.from ? this.normalizeDateOnly(query.from) : undefined,
              lte: query.to ? this.normalizeDateOnly(query.to) : undefined,
            },
          }
        : {}),
      ...(query.teamId
        ? {
            user: {
              teamMembership: {
                some: {
                  tenantId,
                  teamId: query.teamId,
                },
              },
            },
          }
        : {}),
    };

    if (this.isEndUser(actor)) {
      where.userId = actor.sub;
    }

    if (this.isTeamLead(actor)) {
      const leadTeamIds = await this.getLeadTeamIds(tenantId, actor.sub);
      where.user = {
        teamMembership: {
          some: {
            tenantId,
            teamId: {
              in: leadTeamIds,
            },
          },
        },
      };

      if (!query.userId && !query.teamId) {
        where.OR = [
          {
            user: {
              teamMembership: {
                some: {
                  tenantId,
                  teamId: { in: leadTeamIds },
                },
              },
            },
          },
          { userId: actor.sub },
        ];
      }
    }

    const rows = await this.prisma.attendanceDay.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: rows,
      total: rows.length,
    };
  }

  async createRegularization(
    tenantId: string,
    actor: Express.User,
    dto: CreateRegularizationDto,
  ) {
    const dayDate = this.normalizeDateOnly(dto.date);

    const attendanceDay = dto.attendanceDayId
      ? await this.prisma.attendanceDay.findFirst({
          where: {
            tenantId,
            id: dto.attendanceDayId,
            userId: actor.sub,
          },
        })
      : await this.prisma.attendanceDay.findUnique({
          where: {
            tenantId_userId_date: {
              tenantId,
              userId: actor.sub,
              date: dayDate,
            },
          },
        });

    if (!attendanceDay) {
      throw new NotFoundException('Attendance day not found for regularization');
    }

    if (dto.correctedCheckOutAt <= dto.correctedCheckInAt) {
      throw new BadRequestException('Corrected check-out must be after corrected check-in');
    }

    const requestCode = await this.requestCodeService.next(
      tenantId,
      'attendance_regularization',
    );

    const regularization = await this.prisma.attendanceRegularizationRequest.create({
      data: {
        tenantId,
        requestCode,
        userId: actor.sub,
        attendanceDayId: attendanceDay.id,
        correctedCheckInAt: dto.correctedCheckInAt,
        correctedCheckOutAt: dto.correctedCheckOutAt,
        reason: dto.reason,
        status: ApprovalStatus.PENDING,
      },
    });

    const approval = await this.approvalsService.createSingleStepApproval({
      tenantId,
      targetType: ApprovalTargetType.ATTENDANCE_REGULARIZATION,
      targetId: regularization.id,
      requesterId: actor.sub,
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'ATTENDANCE_REGULARIZATION_CREATE',
      entityType: 'AttendanceRegularizationRequest',
      entityId: regularization.id,
      metadata: {
        attendanceDayId: attendanceDay.id,
        approvalRequestId: approval.approvalRequestId,
      },
    });

    return {
      ...regularization,
      approvalRequestId: approval.approvalRequestId,
      currentStep: approval.currentStep,
    };
  }

  async listRegularization(
    tenantId: string,
    actor: Express.User,
    query: ListRegularizationDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AttendanceRegularizationRequestWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (this.isEndUser(actor)) {
      where.userId = actor.sub;
    }

    if (this.isTeamLead(actor)) {
      const leadTeamIds = await this.getLeadTeamIds(tenantId, actor.sub);
      where.OR = [
        {
          user: {
            teamMembership: {
              some: {
                tenantId,
                teamId: { in: leadTeamIds },
              },
            },
          },
        },
        { userId: actor.sub },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.attendanceRegularizationRequest.count({ where }),
      this.prisma.attendanceRegularizationRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          attendanceDay: {
            select: { id: true, date: true, checkInAt: true, checkOutAt: true },
          },
        },
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

  async approveRegularization(
    tenantId: string,
    actor: Express.User,
    regularizationId: string,
    dto: RegularizationActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.ATTENDANCE_REGULARIZATION,
      regularizationId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for regularization');
    }

    return this.approvalsService.approve(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  async rejectRegularization(
    tenantId: string,
    actor: Express.User,
    regularizationId: string,
    dto: RegularizationActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.ATTENDANCE_REGULARIZATION,
      regularizationId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for regularization');
    }

    return this.approvalsService.reject(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  private async getOfficePolicy(tenantId: string): Promise<OfficePolicy> {
    const settings = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
      select: { extras: true },
    });

    const extras =
      settings?.extras && typeof settings.extras === 'object' && !Array.isArray(settings.extras)
        ? (settings.extras as Record<string, unknown>)
        : {};

    const officeStartTime =
      typeof extras.officeStartTime === 'string' ? extras.officeStartTime : '09:30';
    const officeEndTime =
      typeof extras.officeEndTime === 'string' ? extras.officeEndTime : '18:30';
    const officeGeoFenceMeters =
      typeof extras.officeGeoFenceMeters === 'number' && extras.officeGeoFenceMeters > 0
        ? extras.officeGeoFenceMeters
        : 150;

    return {
      officeStartTime,
      officeEndTime,
      officeGeoFenceMeters,
    };
  }

  private calculateLateMinutes(checkInAt: Date, officeStartTime: string): number {
    const [hours, minutes] = this.parseTime(officeStartTime);
    const threshold = new Date(checkInAt);
    threshold.setUTCHours(hours, minutes, 0, 0);

    const diff = checkInAt.getTime() - threshold.getTime();
    return diff > 0 ? Math.floor(diff / (60 * 1000)) : 0;
  }

  private calculateEarlyLogoutMinutes(checkOutAt: Date, officeEndTime: string): number {
    const [hours, minutes] = this.parseTime(officeEndTime);
    const threshold = new Date(checkOutAt);
    threshold.setUTCHours(hours, minutes, 0, 0);

    const diff = threshold.getTime() - checkOutAt.getTime();
    return diff > 0 ? Math.floor(diff / (60 * 1000)) : 0;
  }

  private parseTime(value: string): [number, number] {
    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return [9, 30];
    }

    return [hours, minutes];
  }

  private normalizeDateOnly(input: Date): Date {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }

  private async resolveOfficeStatus(
    tenantId: string,
    requestIp: string | undefined,
    latitude: number | undefined,
    longitude: number | undefined,
    geoFenceMeters: number,
  ): Promise<{ isOffice: boolean; locationId: string | null }> {
    const normalizedIp = this.normalizeIp(requestIp);

    const [officeIps, officeLocations] = await Promise.all([
      this.prisma.officeIp.findMany({
        where: { tenantId, isActive: true },
        select: { cidr: true },
      }),
      this.prisma.officeLocation.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, latitude: true, longitude: true },
      }),
    ]);

    const ipMatch =
      normalizedIp !== null &&
      officeIps.some((rule) => this.isIpInCidr(normalizedIp, rule.cidr));

    if (ipMatch) {
      return { isOffice: true, locationId: null };
    }

    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      officeLocations.length > 0
    ) {
      for (const location of officeLocations) {
        if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
          continue;
        }

        const distanceMeters = this.haversineMeters(
          latitude,
          longitude,
          location.latitude,
          location.longitude,
        );

        if (distanceMeters <= geoFenceMeters) {
          return { isOffice: true, locationId: location.id };
        }
      }
    }

    return { isOffice: false, locationId: null };
  }

  private normalizeIp(input: string | undefined): string | null {
    if (!input) {
      return null;
    }

    const raw = input.trim();

    if (raw.includes(':')) {
      const ipv4Tail = raw.split(':').pop();
      if (ipv4Tail && this.isIpv4(ipv4Tail)) {
        return ipv4Tail;
      }
      return null;
    }

    return this.isIpv4(raw) ? raw : null;
  }

  private isIpv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [baseIp, maskRaw] = cidr.split('/');
    const maskBits = Number(maskRaw);

    if (
      !baseIp ||
      !this.isIpv4(baseIp) ||
      !Number.isInteger(maskBits) ||
      maskBits < 0 ||
      maskBits > 32
    ) {
      return false;
    }

    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (this.ipv4ToInt(ip) & mask) === (this.ipv4ToInt(baseIp) & mask);
  }

  private ipv4ToInt(ip: string): number {
    return ip
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, value) => (acc << 8) + value, 0) >>> 0;
  }

  private haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && actor.roles.includes(Role.TEAM_LEAD);
  }

  private isEndUser(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && !this.isTeamLead(actor);
  }

  private async getLeadTeamIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId,
      },
      select: { teamId: true },
    });

    return rows.map((entry) => entry.teamId);
  }
}
