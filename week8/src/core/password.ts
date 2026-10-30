import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Credentials } from '../types.js';

const KEY_LENGTH = 32;

/** 以 scrypt 建立密碼雜湊與隨機鹽值。 */
export function hashPassword(password: string): Credentials {
  const salt = randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: scryptSync(password, salt, KEY_LENGTH).toString('hex') };
}

/** 以固定時間比較密碼，避免用回應時間推測內容。 */
export function verifyPassword(password: string, credentials: Credentials): boolean {
  const expected = Buffer.from(credentials.passwordHash, 'hex');
  const actual = scryptSync(password, credentials.passwordSalt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
