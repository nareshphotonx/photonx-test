import { createHash, randomBytes } from 'crypto';

export const generateRefreshToken = (): string => randomBytes(48).toString('hex');

export const hashRefreshToken = (refreshToken: string): string =>
  createHash('sha256').update(refreshToken).digest('hex');
