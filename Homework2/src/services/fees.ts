import { badRequest, forbidden, notFound } from '../core/errors.js';
import { newId, newSerial } from '../util/id.js';
import type { Database, FeeBill, Payment, PaymentMethod, Term } from '../types.js';
import { PAYMENT_METHODS } from '../types.js';

/** 應繳總額（含學費減免抵扣）。 */
export function totalOf(bill: FeeBill): number {
  const sum = bill.items.reduce((acc, item) => acc + item.amount, 0);
  return Math.max(0, sum - bill.discount);
}

/** 已繳金額。 */
export function paidOf(bill: FeeBill): number {
  return bill.items.filter((item) => item.paid).reduce((acc, item) => acc + item.amount, 0);
}

/** 未繳金額。 */
export function balanceOf(bill: FeeBill): number {
  return Math.max(0, totalOf(bill) - paidOf(bill));
}

export type BillStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

/** 繳費狀態；逾期未繳者標為 `overdue`。 */
export function statusOf(bill: FeeBill, now: Date = new Date()): BillStatus {
  const balance = balanceOf(bill);
  if (balance === 0) return 'paid';
  if (paidOf(bill) > 0) return 'partial';
  const due = new Date(`${bill.dueDate}T23:59:59+08:00`);
  return now.getTime() > due.getTime() ? 'overdue' : 'unpaid';
}

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: '已繳清',
  partial: '部分繳費',
  unpaid: '未繳費',
  overdue: '逾期未繳',
};

/** 某位學生某學期的繳費單。 */
export function billOf(db: Database, studentId: string, term: Term): FeeBill | undefined {
  return db.bills.find((bill) => bill.studentId === studentId && bill.term === term);
}

/** 某位學生的所有繳費單（依學期排序）。 */
export function billsOf(db: Database, studentId: string): FeeBill[] {
  return db.bills.filter((bill) => bill.studentId === studentId).sort((a, b) => b.term.localeCompare(a.term));
}

/** 繳費紀錄。 */
export function paymentsOf(db: Database, studentId: string): Payment[] {
  return db.payments
    .filter((payment) => payment.studentId === studentId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** 全校繳費總覽（管理員用）。 */
export interface BillSummary {
  term: Term;
  billed: number;
  paid: number;
  outstanding: number;
  students: number;
  cleared: number;
}

export function summaryOf(db: Database, term: Term): BillSummary {
  const bills = db.bills.filter((bill) => bill.term === term);
  const billed = bills.reduce((acc, bill) => acc + totalOf(bill), 0);
  const paid = bills.reduce((acc, bill) => acc + paidOf(bill), 0);
  return {
    term,
    billed,
    paid,
    outstanding: Math.max(0, billed - paid),
    students: bills.length,
    cleared: bills.filter((bill) => balanceOf(bill) === 0).length,
  };
}

export interface PayResult {
  bill: FeeBill;
  payment: Payment;
  /** 本次實際沖銷的項目名稱。 */
  cleared: string[];
}

/**
 * 線上繳費。
 *
 * 依序沖銷未付款的項目（學費 → 雜費 → 其他），並寫入一筆繳費紀錄。
 * 若金額不足則拒絕；金額超過剩餘餘額時，只收取剩餘金額並回報剩餘的項目。
 */
export function pay(
  db: Database,
  actorId: string,
  billId: string,
  amount: number,
  method: PaymentMethod,
  now: Date = new Date(),
): PayResult {
  const bill = db.bills.find((item) => item.id === billId);
  if (bill === undefined) throw notFound('找不到這張繳費單');
  if (actorId !== bill.studentId) throw forbidden('只能繳費自己的費用');

  if (!PAYMENT_METHODS.includes(method)) throw badRequest(`不支援的繳費方式：${method}`);
  if (!Number.isInteger(amount) || amount <= 0) throw badRequest('繳費金額必須是正整數');
  if (amount % 100 !== 0) throw badRequest('繳費金額必須是 100 元的倍數');

  const balance = balanceOf(bill);
  if (balance === 0) throw badRequest('這張繳費單已經繳清');
  if (amount > balance) throw badRequest(`繳費金額 ${amount} 元超過應繳餘額 ${balance} 元`);

  // 已繳狀態記在各項目上，因此金額必須剛好對應「依序沖銷前 n 項」的合計，
  // 否則會出現收了錢卻沒有任何項目被沖銷的情況。
  const options = acceptableAmounts(bill);
  if (!options.includes(amount)) {
    throw badRequest(`繳費金額 ${amount} 元不符合規定，請選擇 ${options.join('、')} 元`);
  }

  const at = now.toISOString();
  const cleared: string[] = [];
  let remaining = amount;
  for (const item of bill.items) {
    if (item.paid) continue;
    if (remaining < item.amount) break;
    item.paid = true;
    item.paidAt = at;
    remaining -= item.amount;
    cleared.push(item.name);
  }

  const serial = newSerial(bill.term, db.payments.length + 1);
  const payment: Payment = {
    id: newId('pay'),
    billId: bill.id,
    studentId: bill.studentId,
    amount,
    method,
    serial,
    paidAt: at,
  };
  db.payments.push(payment);
  return { bill, payment, cleared };
}

/**
 * 這張繳費單目前可接受的繳費金額。
 *
 * 已繳項目不會再出現；每次繳費必須從最前面的未繳項目開始，一次沖銷一個或
 * 多個完整項目，回傳所有合法的累計金額供介面與驗證使用。
 */
export function acceptableAmounts(bill: FeeBill): number[] {
  const options: number[] = [];
  let sum = 0;
  for (const item of bill.items) {
    if (item.paid) continue;
    sum += item.amount;
    options.push(sum);
  }
  return options;
}

/** 驗證金額輸入字串。 */
export function parseAmount(raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw badRequest('請輸入有效的繳費金額');
  }
  return value;
}