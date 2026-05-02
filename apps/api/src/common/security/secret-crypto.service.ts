import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class SecretCryptoService {
  private readonly logger = new Logger(SecretCryptoService.name);

  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string): string {
    if (!plainText) {
      return plainText;
    }

    const key = this.resolveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string | null | undefined): string | null {
    if (!cipherText) {
      return null;
    }

    const [ivBase64, tagBase64, encryptedBase64] = cipherText.split(':');

    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
      this.logger.warn('Encrypted payload format is invalid; returning null');
      return null;
    }

    try {
      const key = this.resolveKey();
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');
      const encrypted = Buffer.from(encryptedBase64, 'base64');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Failed to decrypt integration secret', error as Error);
      return null;
    }
  }

  maskSecret(value: string | null | undefined): string {
    if (!value) {
      return '****';
    }

    if (value.length <= 4) {
      return '****';
    }

    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }

  maskObject<T extends Record<string, unknown>>(obj: T): T {
    const masked = { ...obj };

    for (const [key, value] of Object.entries(masked)) {
      const sensitive = /(secret|token|password|key|webhook|smtp)/i.test(key);
      if (sensitive && typeof value === 'string') {
        (masked as Record<string, unknown>)[key] = this.maskSecret(value);
      }
    }

    return masked;
  }

  private resolveKey(): Buffer {
    const source = this.configService.get<string>('APP_ENCRYPTION_KEY', 'photonx-dev-encryption-key');
    return createHash('sha256').update(source).digest();
  }
}
