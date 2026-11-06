import { badRequest, forbidden, notFound } from '../core/errors.js';
import type { Database, Job, LedgerEntry, Promotion, PromotionPlan, Topup, User } from '../types.js';
import { PROMOTION_PLANS, WALLET_RULES } from '../types.js';
import { newId } from '../util/id.js';
import { extendOrCreatePaidPromotion } from './promotion.js';

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ledgerOf(db: Database, userId: string): LedgerEntry[] {
  return db.ledger
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function topupsOf(db: Database, userId: string): Topup[] {
  return db.topups
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function writeLedger(
  db: Database,
  user: User,
  kind: LedgerEntry['kind'],
  amount: number,
  note: string,
  nowISO: string,
): LedgerEntry {
  const entry: LedgerEntry = {
    id: newId('led'),
    userId: user.id,
    kind,
    amount,
    balanceAfter: user.balance,
    note,
    createdAt: nowISO,
  };
  db.ledger.push(entry);
  return entry;
}

/** 模擬儲值：直接把金額加進錢包並留下流水。 */
export function topUp(db: Database, user: User, amount: number, method: string, nowISO: string): Topup {
  if (user.role !== 'employer') throw forbidden('只有企業帳號需要儲值曝光金');
  if (!Number.isInteger(amount) || amount < WALLET_RULES.topupMin || amount > WALLET_RULES.topupMax) {
    throw badRequest(`儲值金額必須是 ${WALLET_RULES.topupMin} 到 ${WALLET_RULES.topupMax} 之間的整數`);
  }

  user.balance = roundMoney(user.balance + amount);
  const topup: Topup = {
    id: newId('top'),
    userId: user.id,
    amount,
    method: method.trim() === '' ? '信用卡（模擬）' : method.trim(),
    createdAt: nowISO,
  };
  db.topups.push(topup);
  writeLedger(db, user, 'topup', amount, `錢包儲值（${topup.method}）`, nowISO);
  return topup;
}

export function findPlan(days: number): PromotionPlan | undefined {
  return PROMOTION_PLANS.find((plan) => plan.days === days);
}

/**
 * 用錢包餘額購買職缺曝光。
 *
 * 只有職缺擁有者可以購買，且職缺必須是公開狀態；若已有進行中的曝光，
 * 會直接延長期限並累加金額。
 */
export function purchasePromotion(
  db: Database,
  user: User,
  job: Job,
  plan: PromotionPlan,
  nowISO: string,
): Promotion {
  if (job.employerId !== user.id) throw forbidden('只能替自己的職缺購買曝光');
  if (!job.published) throw badRequest('請先公開職缺，再購買曝光');
  if (user.balance < plan.price) {
    throw badRequest(`錢包餘額不足，還需要 NT$ ${plan.price - user.balance}，請先儲值`);
  }

  user.balance = roundMoney(user.balance - plan.price);
  const promotion = extendOrCreatePaidPromotion(db, job, plan, nowISO);
  writeLedger(db, user, 'promotion', -plan.price, `「${job.title}」${plan.days} 天曝光`, nowISO);
  return promotion;
}

export function needPlan(days: number): PromotionPlan {
  const plan = findPlan(days);
  if (plan === undefined) throw notFound('找不到這個曝光方案');
  return plan;
}

/** 平台收到的儲值總額（示範用營收指標）。 */
export function totalTopups(db: Database): number {
  return db.topups.reduce((sum, item) => sum + item.amount, 0);
}

/** 平台售出的曝光總額。 */
export function totalPromotionRevenue(db: Database): number {
  return db.promotions.reduce((sum, item) => sum + item.amount, 0);
}
