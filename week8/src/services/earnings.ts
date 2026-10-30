import { badRequest, forbidden, notFound } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Database, Earning, Tip, User, Withdrawal, Work } from '../types.js';
import { REVENUE_RULES } from '../types.js';
import { findById } from './accounts.js';

/** 金額一律先四捨五入到分，避免浮點誤差累積。 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function earningsOf(db: Database, creatorId: string): Earning[] {
  return db.earnings
    .filter((entry) => entry.creatorId === creatorId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function totalEarned(db: Database, creatorId: string): number {
  return roundMoney(
    db.earnings.filter((entry) => entry.creatorId === creatorId).reduce((sum, entry) => sum + entry.amount, 0),
  );
}

export function viewEarned(db: Database, creatorId: string): number {
  return roundMoney(
    db.earnings
      .filter((entry) => entry.creatorId === creatorId && entry.kind === 'view')
      .reduce((sum, entry) => sum + entry.amount, 0),
  );
}

export function tipEarned(db: Database, creatorId: string): number {
  return roundMoney(
    db.earnings
      .filter((entry) => entry.creatorId === creatorId && entry.kind === 'tip')
      .reduce((sum, entry) => sum + entry.amount, 0),
  );
}

/** 已申請但尚未退回的提領金額（審核中與已撥款都先保留）。 */
export function reservedForWithdrawal(db: Database, creatorId: string): number {
  return roundMoney(
    db.withdrawals
      .filter((item) => item.creatorId === creatorId && (item.status === 'pending' || item.status === 'paid'))
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function availableBalance(db: Database, creatorId: string): number {
  return roundMoney(totalEarned(db, creatorId) - reservedForWithdrawal(db, creatorId));
}

export function pendingWithdrawalOf(db: Database, creatorId: string): Withdrawal | undefined {
  return db.withdrawals.find((item) => item.creatorId === creatorId && item.status === 'pending');
}

export function withdrawalsOf(db: Database, creatorId: string): Withdrawal[] {
  return db.withdrawals
    .filter((item) => item.creatorId === creatorId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
}

/**
 * 記錄一次章節閱讀的收益。
 *
 * 只有付費帳號的作品、且讀者不是作者本人時才計入。匿名讀者的閱讀同樣
 * 會替創作者帶來收益。
 */
export function rewardRead(db: Database, work: Work, chapterTitle: string, reader: User | undefined, nowISO: string): number {
  const creator = findById(db, work.creatorId);
  if (creator === undefined || creator.plan !== 'pro') return 0;
  if (reader !== undefined && reader.id === creator.id) return 0;

  const amount = roundMoney(REVENUE_RULES.viewReward);
  db.earnings.push({
    id: newId('earn'),
    creatorId: creator.id,
    workId: work.id,
    kind: 'view',
    amount,
    note: `〈${chapterTitle}〉閱讀收益`,
    createdAt: nowISO,
  });
  return amount;
}

/** 讀者打賞。只有付費帳號的作品可以收款，平台抽 10%。 */
export function tipWork(
  db: Database,
  work: Work,
  fromUser: User,
  amount: number,
  message: string,
  nowISO: string,
): Tip {
  const creator = findById(db, work.creatorId);
  if (creator === undefined) throw notFound('找不到作品作者');
  if (creator.id === fromUser.id) throw badRequest('不能打賞自己的作品');
  if (creator.plan !== 'pro') {
    throw badRequest('這部作品的創作者尚未開通付費帳號，目前不接受打賞');
  }
  if (!Number.isInteger(amount) || amount < REVENUE_RULES.tipMin || amount > REVENUE_RULES.tipMax) {
    throw badRequest(`打賞金額必須是 ${REVENUE_RULES.tipMin} 到 ${REVENUE_RULES.tipMax} 之間的整數`);
  }

  const creatorShare = roundMoney(amount * REVENUE_RULES.creatorTipShare);
  const tip: Tip = {
    id: newId('tip'),
    workId: work.id,
    creatorId: creator.id,
    fromUserId: fromUser.id,
    amount,
    message: message.trim(),
    creatorShare,
    platformShare: roundMoney(amount - creatorShare),
    createdAt: nowISO,
  };
  db.tips.push(tip);
  db.earnings.push({
    id: newId('earn'),
    creatorId: creator.id,
    workId: work.id,
    kind: 'tip',
    amount: creatorShare,
    note: `〈${work.title}〉讀者打賞分潤`,
    createdAt: nowISO,
  });
  return tip;
}

export function requestWithdrawal(db: Database, user: User, amount: number, note: string, nowISO: string): Withdrawal {
  if (user.plan !== 'pro') throw forbidden('只有付費帳號可以申請提領收益');
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < REVENUE_RULES.withdrawMin) {
    throw badRequest(`提領金額必須是整數，且至少 ${REVENUE_RULES.withdrawMin} 元`);
  }
  if (pendingWithdrawalOf(db, user.id) !== undefined) {
    throw badRequest('你已有一筆審核中的提領申請，請等平台處理後再提出');
  }
  const available = availableBalance(db, user.id);
  if (amount > available) {
    throw badRequest(`可提領餘額不足，目前可提領 ${available} 元`);
  }

  const withdrawal: Withdrawal = {
    id: newId('wd'),
    creatorId: user.id,
    amount,
    status: 'pending',
    requestedAt: nowISO,
    processedAt: null,
    note: note.trim(),
  };
  db.withdrawals.push(withdrawal);
  return withdrawal;
}

export function processWithdrawal(
  db: Database,
  withdrawalId: string,
  status: 'paid' | 'rejected',
  note: string,
  nowISO: string,
): Withdrawal {
  const withdrawal = db.withdrawals.find((item) => item.id === withdrawalId);
  if (withdrawal === undefined) throw notFound('找不到這筆提領申請');
  if (withdrawal.status !== 'pending') throw badRequest('這筆提領申請已經處理過了');

  withdrawal.status = status;
  withdrawal.processedAt = nowISO;
  if (note.trim() !== '') withdrawal.note = note.trim();
  return withdrawal;
}

export function pendingWithdrawals(db: Database): Withdrawal[] {
  return db.withdrawals
    .filter((item) => item.status === 'pending')
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
}
