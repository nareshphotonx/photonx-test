import { maskPhone, maskSecret, sanitizeForLog } from './log-sanitizer.util';

describe('log sanitizer utilities', () => {
  it('masks phone values', () => {
    expect(maskPhone('+919876543210')).toBe('+91********10');
    expect(maskPhone('12345')).toBe('****');
  });

  it('masks secrets', () => {
    expect(maskSecret('super-secret-token')).toBe('su****en');
    expect(maskSecret('abc')).toBe('****');
  });

  it('sanitizes nested objects with secret and phone keys', () => {
    const input = {
      email: 'user@example.com',
      phone: '+919876543210',
      nested: {
        smtpPassword: 'my-smtp-password',
        accessToken: 'access-token-value',
      },
    };

    const sanitized = sanitizeForLog(input);
    expect(sanitized.phone).toBe('+91********10');
    expect(sanitized.nested.smtpPassword).toBe('my****rd');
    expect(sanitized.nested.accessToken).toBe('ac****ue');
  });
});

