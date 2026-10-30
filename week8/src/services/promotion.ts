import { newId } from '../util/id.js';
import type { Database, Promotion, User, Work } from '../types.js';
import { REVENUE_RULES } from '../types.js';
import { findById } from './accounts.js';

/** 管理員手動推流的天數。 */
export const ADMIN_PROMOTION_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export function activePromotion(db: Database, workId: string, now: number = Date.now()): Promotion | undefined {
  return db.promotions
    .filter((promotion) => promotion.workId === workId && Date.parse(promotion.expiresAt) > now)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}

export function promotionOf(db: Database, workId: string): Promotion | undefined {
  return db.promotions
    .filter((promotion) => promotion.workId === workId)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}

export function promotedWorks(db: Database, works: Work[], now: number = Date.now()): { work: Work; promotion: Promotion }[] {
  const result: { work: Work; promotion: Promotion }[] = [];
  for (const work of works) {
    const promotion = activePromotion(db, work.id, now);
    if (promotion !== undefined) result.push({ work, promotion });
  }
  return result;
}

/**
 * 付費帳號每次公開作品時，自動取得 7 天的系統推流。
 *
 * 同一部作品若已有進行中的推流就不重複建立，避免短時間內反覆編輯
 * 就把曝光額度洗掉。
 */
export function ensurePlanPromotion(db: Database, work: Work, nowISO: string): Promotion | undefined {
  const creator = findById(db, work.creatorId);
  if (creator === undefined || creator.plan !== 'pro') return undefined;

  const now = Date.parse(nowISO);
  const current = activePromotion(db, work.id, now);
  if (current !== undefined) return current;

  const promotion: Promotion = {
    id: newId('prm'),
    workId: work.id,
    creatorId: work.creatorId,
    source: 'plan',
    startedAt: nowISO,
    expiresAt: new Date(now + REVENUE_RULES.promotionDays * DAY).toISOString(),
    impressions: 0,
    clicks: 0,
  };
  db.promotions.push(promotion);
  return promotion;
}

/** 管理員手動替任何作品開啟一段推流（免費帳號的作品也可以）。 */
export function startAdminPromotion(db: Database, work: Work, nowISO: string, days = ADMIN_PROMOTION_DAYS): Promotion {
  const now = Date.parse(nowISO);
  const promotion: Promotion = {
    id: newId('prm'),
    workId: work.id,
    creatorId: work.creatorId,
    source: 'admin',
    startedAt: nowISO,
    expiresAt: new Date(now + days * DAY).toISOString(),
    impressions: 0,
    clicks: 0,
  };
  db.promotions.push(promotion);
  return promotion;
}

export function recordImpressions(db: Database, promotions: Promotion[], count = 1): void {
  for (const promotion of promotions) {
    if (db.promotions.includes(promotion)) promotion.impressions += count;
  }
}

export function recordClick(db: Database, workId: string, now: number = Date.now()): void {
  const promotion = activePromotion(db, workId, now);
  if (promotion !== undefined) promotion.clicks += 1;
}

export interface PromotionStats {
  active: number;
  impressions: number;
  clicks: number;
  clickRate: number;
}

export function promotionStatsOf(db: Database, creatorId: string, now: number = Date.now()): PromotionStats {
  const own = db.promotions.filter((promotion) => promotion.creatorId === creatorId);
  const active = own.filter((promotion) => Date.parse(promotion.expiresAt) > now).length;
  const impressions = own.reduce((sum, promotion) => sum + promotion.impressions, 0);
  const clicks = own.reduce((sum, promotion) => sum + promotion.clicks, 0);
  return {
    active,
    impressions,
    clicks,
    clickRate: impressions === 0 ? 0 : Math.round((clicks / impressions) * 1000) / 10,
  };
}

export function activePromotionCount(db: Database, creator: User, now: number = Date.now()): number {
  return db.promotions.filter(
    (promotion) => promotion.creatorId === creator.id && Date.parse(promotion.expiresAt) > now,
  ).length;
}
