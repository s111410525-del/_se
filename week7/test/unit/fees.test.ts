import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  acceptableAmounts,
  balanceOf,
  billsOf,
  billOf,
  paidOf,
  parseAmount,
  pay,
  paymentsOf,
  statusOf,
  summaryOf,
  totalOf,
} from '../../src/services/fees.js';
import type { FeeBill, PaymentMethod } from '../../src/types.js';
import { freshDb } from './helpers.js';

function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && 'status' in err && err.status === status;
}

function readBill(id: string): FeeBill {
  const db = freshDb();
  const bill = db.bills.find((item) => item.id === id);
  if (bill === undefined) throw new Error(`測試資料缺少繳費單 ${id}`);
  return bill;
}

describe('繳費金額計算', () => {
  test('totalOf 加總所有項目並扣除減免', () => {
    const bill = readBill('b_1151_s001');
    assert.equal(totalOf(bill), 67050);
    bill.discount = 1000;
    assert.equal(totalOf(bill), 66050);
  });

  test('減免大於總額時應繳金額為 0', () => {
    const bill = readBill('b_1151_s001');
    bill.discount = 999999;
    assert.equal(totalOf(bill), 0);
  });

  test('paidOf 與 balanceOf 反映已繳項目', () => {
    const bill = readBill('b_1151_s001');
    assert.equal(paidOf(bill), 51000);
    assert.equal(balanceOf(bill), 16050);
  });

  test('acceptableAmounts 列出可一次沖銷的合法金額', () => {
    assert.deepEqual(acceptableAmounts(readBill('b_1151_s001')), [13800, 15800, 16050]);
  });

  test('已繳項目不會出現在合法金額中', () => {
    assert.deepEqual(acceptableAmounts(readBill('b_1151_s002')), [2000, 2250]);
  });
});

describe('繳費狀態', () => {
  test('全部繳清為 paid', () => {
    assert.equal(statusOf(readBill('b_1151_s004'), new Date('2026-10-01T00:00:00+08:00')), 'paid');
  });

  test('部分繳費為 partial', () => {
    assert.equal(statusOf(readBill('b_1151_s001'), new Date('2026-10-01T00:00:00+08:00')), 'partial');
  });

  test('未逾期未繳為 unpaid', () => {
    assert.equal(statusOf(readBill('b_1151_s003'), new Date('2026-10-01T00:00:00+08:00')), 'unpaid');
  });

  test('逾期未繳為 overdue', () => {
    assert.equal(statusOf(readBill('b_1151_s003'), new Date('2027-01-01T00:00:00+08:00')), 'overdue');
  });
});

describe('線上繳費', () => {
  test('可以部分繳費並產生收據', () => {
    const db = freshDb();
    const result = pay(db, 'u_s001', 'b_1151_s001', 13800, 'ATM', new Date('2026-10-05T01:00:00.000Z'));

    assert.deepEqual(result.cleared, ['雜費']);
    assert.equal(result.payment.amount, 13800);
    assert.equal(result.payment.method, 'ATM');
    assert.equal(result.payment.paidAt, '2026-10-05T01:00:00.000Z');
    assert.match(result.payment.serial, /^NQU1151/u);
    assert.equal(balanceOf(result.bill), 2250);
    assert.equal(statusOf(result.bill, new Date('2026-10-05T01:00:00.000Z')), 'partial');
    assert.equal(paymentsOf(db, 'u_s001').length, 2);
  });

  test('一次繳清全部餘額', () => {
    const db = freshDb();
    const result = pay(db, 'u_s001', 'b_1151_s001', 16050, '線上刷卡', new Date('2026-10-05T01:00:00Z'));
    assert.deepEqual(result.cleared, ['雜費', '電腦與網路使用費', '平安保險費']);
    assert.equal(balanceOf(result.bill), 0);
    assert.equal(statusOf(result.bill), 'paid');
  });

  test('不能繳別人的費用', () => {
    const db = freshDb();
    assert.throws(
      () => pay(db, 'u_s002', 'b_1151_s001', 13800, 'ATM'),
      (err: unknown) => isStatus(err, 403),
    );
  });

  test('金額必須是正整數且對應完整項目', () => {
    const db = freshDb();
    for (const amount of [0, -100, 1.5, 150]) {
      assert.throws(
        () => pay(db, 'u_s001', 'b_1151_s001', amount, 'ATM'),
        (err: unknown) => isStatus(err, 400),
      );
    }
  });

  test('金額不能超過餘額', () => {
    const db = freshDb();
    assert.throws(
      () => pay(db, 'u_s001', 'b_1151_s001', 999900, 'ATM'),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /超過應繳餘額/u.test(err.message),
    );
  });

  test('金額必須對應完整項目', () => {
    const db = freshDb();
    assert.throws(
      () => pay(db, 'u_s001', 'b_1151_s001', 2200, 'ATM'),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /不符合規定/u.test(err.message),
    );
  });

  test('不支援的繳費方式會被拒絕', () => {
    const db = freshDb();
    assert.throws(
      () => pay(db, 'u_s001', 'b_1151_s001', 13800, 'Bitcoin' as PaymentMethod),
      (err: unknown) => isStatus(err, 400),
    );
  });

  test('找不到繳費單時回傳 404', () => {
    const db = freshDb();
    assert.throws(
      () => pay(db, 'u_s001', 'missing', 13800, 'ATM'),
      (err: unknown) => isStatus(err, 404),
    );
  });

  test('已繳清後不能再繳費', () => {
    const db = freshDb();
    const bill = db.bills.find((item) => item.id === 'b_1151_s004');
    assert.ok(bill !== undefined);
    assert.equal(balanceOf(bill), 0);
    assert.throws(
      () => pay(db, 'u_s004', bill.id, 1000, 'ATM'),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /已經繳清/u.test(err.message),
    );
  });

  test('parseAmount 接受前後空白', () => {
    assert.equal(parseAmount(' 250 '), 250);
  });

  test('parseAmount 拒絕無效數字', () => {
    for (const raw of ['', 'abc', '1.5', '-1', '0']) {
      assert.throws(() => parseAmount(raw), (err: unknown) => isStatus(err, 400));
    }
  });
});

describe('繳費查詢與總覽', () => {
  test('billOf 依學生與學期查詢', () => {
    const db = freshDb();
    assert.equal(billOf(db, 'u_s001', '115-1')?.id, 'b_1151_s001');
    assert.equal(billOf(db, 'u_s001', '999-9'), undefined);
  });

  test('billsOf 依學期由新到舊排序', () => {
    const db = freshDb();
    assert.deepEqual(billsOf(db, 'u_s001').map((bill) => bill.term), ['115-1', '114-2']);
  });

  test('paymentsOf 依時間由新到舊排序', () => {
    const db = freshDb();
    const payments = paymentsOf(db, 'u_s002');
    assert.deepEqual(payments.map((payment) => payment.amount), [13800, 51000]);
  });

  test('summaryOf 統計全校繳費狀況', () => {
    const db = freshDb();
    const summary = summaryOf(db, '115-1');
    assert.equal(summary.students, 5);
    assert.equal(summary.cleared, 1);
    assert.equal(summary.billed, 335250);
    assert.equal(summary.paid, 183100);
    assert.equal(summary.outstanding, 152150);
  });
});
