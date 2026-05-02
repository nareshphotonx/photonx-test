import { Injectable } from '@nestjs/common';
import { IntegrationType, Prisma } from '@prisma/client';
import { SecretCryptoService } from '../../common/security/secret-crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class IntegrationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretCryptoService: SecretCryptoService,
  ) {}

  async upsert(
    tenantId: string,
    type: IntegrationType,
    actorId: string,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    enabled: boolean,
  ) {
    const encryptedSecrets =
      Object.keys(secrets).length > 0
        ? this.secretCryptoService.encrypt(JSON.stringify(secrets))
        : null;

    return this.prisma.integrationSetting.upsert({
      where: {
        tenantId_type: {
          tenantId,
          type,
        },
      },
      update: {
        enabled,
        config: config as Prisma.InputJsonValue,
        encryptedSecrets,
        updatedBy: actorId,
      },
      create: {
        tenantId,
        type,
        enabled,
        config: config as Prisma.InputJsonValue,
        encryptedSecrets,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
  }

  async get(tenantId: string, type: IntegrationType) {
    const setting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type,
        },
      },
    });

    if (!setting) {
      return null;
    }

    const secrets = this.readSecrets(setting.encryptedSecrets);

    return {
      ...setting,
      decryptedSecrets: secrets,
      maskedSecrets: this.secretCryptoService.maskObject(secrets),
    };
  }

  readSecrets(cipherText: string | null): Record<string, string> {
    const decrypted = this.secretCryptoService.decrypt(cipherText);

    if (!decrypted) {
      return {};
    }

    try {
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      return {};
    }
  }

  readConfig(config: Prisma.JsonValue | null): Record<string, unknown> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {};
    }

    return config as Record<string, unknown>;
  }
}
