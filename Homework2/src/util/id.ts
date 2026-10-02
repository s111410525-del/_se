import { randomUUID } from 'node:crypto';

/**
 * 產生帶前綴的隨機識別碼，例如 `enr_3f2a91b0c4d5`。
 *
 * 前綴讓除錯時可以一眼看出資料來源，而 UUID 的隨機性避免學生學號等
 * 連續數字被猜測。
 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
}

/** 產生繳費單的流水號，例如 `NQU1151-0007`。 */
export function newSerial(term: string, index: number): string {
  const compact = term.replace('-', '');
  return `NQU${compact}-${String(index).padStart(4, '0')}`;
}