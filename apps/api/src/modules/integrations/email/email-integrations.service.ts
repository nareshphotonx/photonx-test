import { Injectable } from '@nestjs/common';
import { IntegrationType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { IntegrationSettingsService } from '../integration-settings.service';
import { UpsertEmailSettingsDto } from './dto/upsert-email-settings.dto';

@Injectable()
export class EmailIntegrationsService {
  constructor(
    private readonly settingsService: IntegrationSettingsService,
    private readonly auditService: AuditService,
  ) {}

  async upsertSettings(tenantId: string, actorId: string, dto: UpsertEmailSettingsDto) {
    const setting = await this.settingsService.upsert(
      tenantId,
      IntegrationType.EMAIL,
      actorId,
      {
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort ?? 587,
        secure: dto.secure ?? false,
        fromEmail: dto.fromEmail,
      },
      {
        smtpUser: dto.smtpUser,
        smtpPassword: dto.smtpPassword,
      },
      dto.enabled ?? true,
    );

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'EMAIL_SETTINGS_UPSERT',
      entityType: 'IntegrationSetting',
      entityId: setting.id,
      metadata: {
        enabled: setting.enabled,
      },
    });

    return {
      id: setting.id,
      enabled: setting.enabled,
      type: setting.type,
    };
  }
}
