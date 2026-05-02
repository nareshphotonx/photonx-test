import { Injectable } from '@nestjs/common';
import { IntegrationType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { IntegrationSettingsService } from '../integration-settings.service';
import { UpsertSlackSettingsDto } from './dto/upsert-slack-settings.dto';

@Injectable()
export class SlackIntegrationsService {
  constructor(
    private readonly settingsService: IntegrationSettingsService,
    private readonly auditService: AuditService,
  ) {}

  async upsertSettings(tenantId: string, actorId: string, dto: UpsertSlackSettingsDto) {
    const setting = await this.settingsService.upsert(
      tenantId,
      IntegrationType.SLACK,
      actorId,
      {
        defaultChannel: dto.defaultChannel ?? null,
      },
      {
        webhookUrl: dto.webhookUrl,
      },
      dto.enabled ?? true,
    );

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'SLACK_SETTINGS_UPSERT',
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
