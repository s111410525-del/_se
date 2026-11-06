import type { Database, Job, Promotion, PromotionPlan } from '../types.js';
import { WALLET_RULES } from '../types.js';
import { newId } from '../util/id.js';

const DAY = 24 * 60 * 60 * 1000;

export function activePromotion(db: Database, jobId: string, now: number = Date.now()): Promotion | undefined {
  return db.promotions
    .filter((promotion) => promotion.jobId === jobId && Date.parse(promotion.expiresAt) > now)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0];
}

export function promotionOf(db: Database, jobId: string): Promotion | undefined {
  return db.promotions
    .filter((promotion) => promotion.jobId === jobId)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0];
}

/** 一次查詢多個職缺的曝光狀態，避免列表頁重複掃描。 */
export function activePromotionMap(db: Database, jobIds: string[], now: number = Date.now()): Map<string, Promotion> {
  const wanted = new Set(jobIds);
  const map = new Map<string, Promotion>();
  for (const promotion of db.promotions) {
    if (!wanted.has(promotion.jobId)) continue;
    if (Date.parse(promotion.expiresAt) <= now) continue;
    const current = map.get(promotion.jobId);
    if (current === undefined || Date.parse(promotion.expiresAt) > Date.parse(current.expiresAt)) {
      map.set(promotion.jobId, promotion);
    }
  }
  return map;
}

export function activePromotionsOf(db: Database, employerId: string, now: number = Date.now()): Promotion[] {
  return db.promotions
    .filter((promotion) => promotion.employerId === employerId && Date.parse(promotion.expiresAt) > now)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt));
}

/** 付費曝光：若已有進行中的曝光就延長期限，避免重複建立多筆。 */
export function extendOrCreatePaidPromotion(
  db: Database,
  job: Job,
  plan: PromotionPlan,
  nowISO: string,
): Promotion {
  const now = Date.parse(nowISO);
  const current = activePromotion(db, job.id, now);
  if (current !== undefined) {
    current.days += plan.days;
    current.amount += plan.price;
    current.expiresAt = new Date(Date.parse(current.expiresAt) + plan.days * DAY).toISOString();
    return current;
  }

  const promotion: Promotion = {
    id: newId('prm'),
    jobId: job.id,
    employerId: job.employerId,
    source: 'wallet',
    days: plan.days,
    amount: plan.price,
    startedAt: nowISO,
    expiresAt: new Date(now + plan.days * DAY).toISOString(),
    impressions: 0,
    clicks: 0,
  };
  db.promotions.push(promotion);
  return promotion;
}

/** 管理員手動贈送曝光，不扣企業錢包。 */
export function startAdminPromotion(db: Database, job: Job, nowISO: string, days = WALLET_RULES.adminPromotionDays): Promotion {
  const now = Date.parse(nowISO);
  const current = activePromotion(db, job.id, now);
  if (current !== undefined) {
    current.days += days;
    current.expiresAt = new Date(Date.parse(current.expiresAt) + days * DAY).toISOString();
    return current;
  }

  const promotion: Promotion = {
    id: newId('prm'),
    jobId: job.id,
    employerId: job.employerId,
    source: 'admin',
    days,
    amount: 0,
    startedAt: nowISO,
    expiresAt: new Date(now + days * DAY).toISOString(),
    impressions: 0,
    clicks: 0,
  };
  db.promotions.push(promotion);
  return promotion;
}

/** 職缺詳情被看見時累計曝光。 */
export function recordImpression(db: Database, jobId: string, now: number = Date.now()): void {
  const promotion = activePromotion(db, jobId, now);
  if (promotion !== undefined) promotion.impressions += 1;
}

/** 使用者按下應徵或查看詳情時累計點擊。 */
export function recordClick(db: Database, jobId: string, now: number = Date.now()): void {
  const promotion = activePromotion(db, jobId, now);
  if (promotion !== undefined) promotion.clicks += 1;
}
