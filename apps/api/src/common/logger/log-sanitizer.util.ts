const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|key|webhook|smtp|authorization|access[-_]?token|refresh[-_]?token)/i;
const PHONE_KEY_PATTERN = /(phone|mobile|whatsapp)/i;

export function maskPhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 6) {
    return '****';
  }

  const prefix = digits.slice(0, 2);
  const suffix = digits.slice(-2);
  const middle = '*'.repeat(Math.max(4, digits.length - 4));

  return `${hasPlus ? '+' : ''}${prefix}${middle}${suffix}`;
}

export function maskSecret(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
}

function isLikelyPhone(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length < 6 || normalized.length > 24) {
    return false;
  }

  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 6) {
    return false;
  }

  return /^[+\d][\d\s\-()]+$/.test(normalized);
}

export function sanitizeForLog<T>(value: T, keyHint?: string): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) {
      return maskSecret(value) as T;
    }

    if ((keyHint && PHONE_KEY_PATTERN.test(keyHint)) || isLikelyPhone(value)) {
      return maskPhone(value) as T;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLog(entry, keyHint)) as T;
  }

  if (typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(input)) {
      if (typeof nestedValue === 'string' && SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = maskSecret(nestedValue);
        continue;
      }

      if (typeof nestedValue === 'string' && PHONE_KEY_PATTERN.test(key)) {
        output[key] = maskPhone(nestedValue);
        continue;
      }

      output[key] = sanitizeForLog(nestedValue, key);
    }

    return output as T;
  }

  return value;
}
