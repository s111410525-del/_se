import { randomUUID } from 'node:crypto';

/** 產生帶前綴的隨機識別碼，例如 `wrk_3f2a91b0c4d5`。 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
}
