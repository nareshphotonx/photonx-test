import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (plain: string): Promise<string> =>
  hash(plain, SALT_ROUNDS);

export const verifyPassword = async (
  plain: string,
  hashed: string,
): Promise<boolean> => compare(plain, hashed);
