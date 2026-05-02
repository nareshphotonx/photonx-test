import { ConfigService } from '@nestjs/config';
import { SecretCryptoService } from './secret-crypto.service';

describe('SecretCryptoService', () => {
  const service = new SecretCryptoService(
    {
      get: (key: string, fallback?: string) =>
        key === 'APP_ENCRYPTION_KEY' ? 'unit-test-key' : fallback,
    } as unknown as ConfigService,
  );

  it('encrypts and decrypts round-trip', () => {
    const encrypted = service.encrypt('hello-world');
    expect(encrypted).not.toBe('hello-world');

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe('hello-world');
  });

  it('masks secret-looking object keys', () => {
    const masked = service.maskObject({
      webhookUrl: 'https://hooks.slack.com/secret',
      safe: 'ok',
      smtpPassword: 'abc12345',
    });

    expect(masked.safe).toBe('ok');
    expect(String(masked.webhookUrl)).toContain('****');
    expect(String(masked.smtpPassword)).toContain('****');
  });
});
