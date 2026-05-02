import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getMine(tenantId: string, userId: string): Promise<{
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
  }> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: {
        userId,
      },
      update: {},
      create: {
        tenantId,
        userId,
      },
    });

    return {
      whatsappEnabled: pref.whatsappEnabled,
      emailEnabled: pref.emailEnabled,
      smsEnabled: pref.smsEnabled,
    };
  }

  async updateMine(
    tenantId: string,
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<{
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
  }> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: {
        userId,
      },
      update: {
        whatsappEnabled: dto.whatsappEnabled,
        emailEnabled: dto.emailEnabled,
        smsEnabled: dto.smsEnabled,
      },
      create: {
        tenantId,
        userId,
        whatsappEnabled: dto.whatsappEnabled ?? true,
        emailEnabled: dto.emailEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? false,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: 'NOTIFICATION_PREFERENCES_UPDATE',
      entityType: 'NotificationPreference',
      entityId: pref.id,
      metadata: dto as Record<string, unknown>,
    });

    return {
      whatsappEnabled: pref.whatsappEnabled,
      emailEnabled: pref.emailEnabled,
      smsEnabled: pref.smsEnabled,
    };
  }
}
