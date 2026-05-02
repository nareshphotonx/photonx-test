import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WfhRequestStatus, LeaveRequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { ListHolidaysDto } from './dto/list-holidays.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createHoliday(tenantId: string, actor: Express.User, dto: CreateHolidayDto) {
    await this.assertLocationIfProvided(tenantId, dto.locationId);

    try {
      const created = await this.prisma.holiday.create({
        data: {
          tenantId,
          locationId: dto.locationId,
          name: dto.name,
          date: this.normalizeDateOnly(dto.date),
          isOptional: dto.isOptional ?? false,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'HOLIDAY_CREATE',
        entityType: 'Holiday',
        entityId: created.id,
        metadata: dto as unknown as Record<string, unknown>,
      });

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Holiday already exists for date/location/name');
      }
      throw error;
    }
  }

  async listHolidays(tenantId: string, query: ListHolidaysDto) {
    return this.prisma.holiday.findMany({
      where: {
        tenantId,
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.isOptional !== undefined ? { isOptional: query.isOptional } : {}),
        ...(query.from || query.to
          ? {
              date: {
                gte: query.from ? this.normalizeDateOnly(query.from) : undefined,
                lte: query.to ? this.normalizeDateOnly(query.to) : undefined,
              },
            }
          : {}),
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });
  }

  async updateHoliday(
    tenantId: string,
    actor: Express.User,
    holidayId: string,
    dto: UpdateHolidayDto,
  ) {
    await this.assertHolidayExists(tenantId, holidayId);
    await this.assertLocationIfProvided(tenantId, dto.locationId);

    const updated = await this.prisma.holiday.update({
      where: { id: holidayId },
      data: {
        name: dto.name,
        date: dto.date ? this.normalizeDateOnly(dto.date) : undefined,
        locationId: dto.locationId,
        isOptional: dto.isOptional,
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'HOLIDAY_UPDATE',
      entityType: 'Holiday',
      entityId: updated.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async deleteHoliday(tenantId: string, actor: Express.User, holidayId: string) {
    await this.assertHolidayExists(tenantId, holidayId);

    await this.prisma.holiday.delete({
      where: { id: holidayId },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'HOLIDAY_DELETE',
      entityType: 'Holiday',
      entityId: holidayId,
    });

    return {
      deleted: true,
      holidayId,
    };
  }

  async claimOptionalHoliday(
    tenantId: string,
    actor: Express.User,
    holidayId: string,
  ) {
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        tenantId,
        id: holidayId,
        isActive: true,
      },
      select: {
        id: true,
        date: true,
        isOptional: true,
      },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    if (!holiday.isOptional) {
      throw new BadRequestException('Only optional holidays can be claimed');
    }

    const existing = await this.prisma.optionalHolidayClaim.findUnique({
      where: {
        tenantId_userId_holidayId: {
          tenantId,
          userId: actor.sub,
          holidayId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Optional holiday already claimed');
    }

    await this.assertNoExistingDayRequestConflict(tenantId, actor.sub, holiday.date);

    const quota = await this.resolveOptionalHolidayQuota(tenantId, actor.sub);

    const yearStart = new Date(Date.UTC(holiday.date.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(holiday.date.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

    const claimedCount = await this.prisma.optionalHolidayClaim.count({
      where: {
        tenantId,
        userId: actor.sub,
        holiday: {
          date: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
      },
    });

    if (claimedCount >= quota) {
      throw new BadRequestException(
        `Optional holiday quota exceeded for year. Quota: ${quota}`,
      );
    }

    const claim = await this.prisma.optionalHolidayClaim.create({
      data: {
        tenantId,
        userId: actor.sub,
        holidayId,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'OPTIONAL_HOLIDAY_CLAIM',
      entityType: 'OptionalHolidayClaim',
      entityId: claim.id,
      metadata: {
        holidayId,
      },
    });

    return {
      ...claim,
      remainingQuota: quota - claimedCount - 1,
    };
  }

  private async resolveOptionalHolidayQuota(
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const [settings, override] = await Promise.all([
      this.prisma.tenantSetting.findUnique({
        where: { tenantId },
        select: { extras: true },
      }),
      this.prisma.optionalHolidayUserQuotaOverride.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
        select: { annualQuota: true },
      }),
    ]);

    if (override) {
      return override.annualQuota;
    }

    const extras =
      settings?.extras && typeof settings.extras === 'object' && !Array.isArray(settings.extras)
        ? (settings.extras as Record<string, unknown>)
        : {};

    const configured = extras.optionalHolidayAnnualQuota;
    if (typeof configured === 'number' && configured >= 0) {
      return Math.floor(configured);
    }
    if (typeof configured === 'string' && Number(configured) >= 0) {
      return Math.floor(Number(configured));
    }

    return 2;
  }

  private async assertNoExistingDayRequestConflict(
    tenantId: string,
    userId: string,
    date: Date,
  ): Promise<void> {
    const normalized = this.normalizeDateOnly(date);
    const dayEnd = new Date(normalized);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const [leaveConflict, wfhConflict] = await Promise.all([
      this.prisma.leaveRequest.findFirst({
        where: {
          tenantId,
          userId,
          status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
          startDate: { lte: dayEnd },
          endDate: { gte: normalized },
        },
        select: { id: true },
      }),
      this.prisma.wfhRequest.findFirst({
        where: {
          tenantId,
          userId,
          status: { in: [WfhRequestStatus.PENDING, WfhRequestStatus.APPROVED] },
          requestDate: normalized,
        },
        select: { id: true },
      }),
    ]);

    if (leaveConflict || wfhConflict) {
      throw new BadRequestException(
        'Optional holiday conflicts with existing leave/WFH request for same date',
      );
    }
  }

  private async assertHolidayExists(tenantId: string, holidayId: string): Promise<void> {
    const exists = await this.prisma.holiday.findFirst({
      where: {
        tenantId,
        id: holidayId,
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Holiday not found');
    }
  }

  private async assertLocationIfProvided(
    tenantId: string,
    locationId: string | undefined,
  ): Promise<void> {
    if (!locationId) {
      return;
    }

    const location = await this.prisma.officeLocation.findFirst({
      where: {
        tenantId,
        id: locationId,
      },
      select: { id: true },
    });

    if (!location) {
      throw new BadRequestException('Invalid locationId for tenant');
    }
  }

  private normalizeDateOnly(input: Date): Date {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
}
