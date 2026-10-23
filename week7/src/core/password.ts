import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Credentials } from '../types.js';

const KEY_LENGTH = 32;

/** 產生一組新的密碼雜湊與鹽。 */
export function hashPassword(password: string): Credentials {
  const salt = randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: scryptSync(password, salt, KEY_LENGTH).toString('hex') };
}

/**
 * 以固定時間比較密碼。
 *
 * `timingSafeEqual` 要求兩個緩衝區長度相同，因此先比對長度；長度不同時
 * 仍然執行一次比較，避免用回應時間推測密碼長度。
 */
export function verifyPassword(password: string, credentials: Credentials): boolean {
  const expected = Buffer.from(credentials.passwordHash, 'hex');
  const actual = scryptSync(password, credentials.passwordSalt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}