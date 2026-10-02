import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from './helpers.js';
import { balanceOf, statusOf } from '../src/services/fees.js';
import { PAYMENT_METHODS, type PaymentMethod } from '../src/types.js';

const METHOD: PaymentMethod = PAYMENT_METHODS[0] ?? 'ATM';

describe('學生繳費', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('s001');
  });

  after(async () => {
    await h.close();
  });

  test('繳費頁顯示待繳金額', async () => {
    const res = await h.browser.get('/fees');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /繳費/);
  });

  test('可以繳費並產生收據', async () => {
    const bill = h.app.store.data.bills.find((row) => row.studentId === 'u_s001');
    assert.ok(bill !== undefined);
    const before = balanceOf(bill);
    assert.ok(before > 0);

    // 雜費 13,800 元是第一個未繳項目，一次沖銷後即可看到部分繳費狀態。
    const res = await h.browser.post(`/fees/${bill.id}/pay`, {
      amount: '13800',
      method: METHOD,
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/fees');

    const updated = h.app.store.data.bills.find((row) => row.id === bill.id);
    assert.ok(updated !== undefined);
    assert.equal(balanceOf(updated), before - 13800);
    assert.equal(statusOf(updated), 'partial');

    const payments = h.app.store.data.payments.filter((row) => row.billId === bill.id);
    assert.ok(payments.length > 0);
    assert.equal(payments.at(-1)?.amount, 13800);
  });

  test('金額不是 100 的倍數時拒絕', async () => {
    const bill = h.app.store.data.bills.find((row) => row.studentId === 'u_s001');
    assert.ok(bill !== undefined);
    const res = await h.browser.post(`/fees/${bill.id}/pay`, { amount: '150', method: METHOD });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /100 元的倍數/);
  });

  test('金額超過餘額時拒絕', async () => {
    const bill = h.app.store.data.bills.find((row) => row.studentId === 'u_s001');
    assert.ok(bill !== undefined);
    const res = await h.browser.post(`/fees/${bill.id}/pay`, {
      amount: '999900',
      method: METHOD,
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /超過應繳餘額/);
  });

  test('金額無法對應完整項目時拒絕', async () => {
    // 前一個測試已繳清雜費，未繳項目只剩 電腦網路 2,000 與 平安保險 250，
    // 合法金額只有 2000 與 2250。
    const bill = h.app.store.data.bills.find((row) => row.studentId === 'u_s001');
    assert.ok(bill !== undefined);
    const res = await h.browser.post(`/fees/${bill.id}/pay`, { amount: '2200', method: METHOD });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /不符合規定/);
  });

  test('繳費金額選單只列出合法金額', async () => {
    const res = await h.browser.get('/fees');
    const html = await res.text();
    assert.match(html, /value="2000"/);
    assert.match(html, /value="2250"/);
  });

  test('不能繳別人的費用', async () => {
    const other = h.app.store.data.bills.find((row) => row.studentId !== 'u_s001');
    assert.ok(other !== undefined);
    const res = await h.browser.post(`/fees/${other.id}/pay`, { amount: '1000', method: METHOD });
    assert.equal(res.status, 403);
  });

  test('繳清後不可再繳', async () => {
    const bill = h.app.store.data.bills.find((row) => row.studentId === 'u_s001');
    assert.ok(bill !== undefined);

    // 直接把剩下未繳的項目標記為已繳，模擬繳清狀態。
    const left = balanceOf(bill);
    assert.ok(left > 0);
    h.app.store.mutate((db) => {
      const target = db.bills.find((row) => row.id === bill.id);
      if (target === undefined) return;
      for (const item of target.items) {
        if (item.paid) continue;
        item.paid = true;
        item.paidAt = new Date().toISOString();
      }
    });
    assert.equal(balanceOf(h.app.store.data.bills.find((row) => row.id === bill.id) ?? bill), 0);

    const res = await h.browser.post(`/fees/${bill.id}/pay`, { amount: '1000', method: METHOD });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /已經繳清/);
  });
});

describe('管理員繳費總覽', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('admin');
  });

  after(async () => {
    await h.close();
  });

  test('可以查看全校繳費統計', async () => {
    const res = await h.browser.get('/admin/fees');
    assert.equal(res.status, 200);
  });

  test('教師無法查看繳費總覽', async () => {
    const teacher = await startHarness();
    try {
      await teacher.browser.login('tchen');
      const res = await teacher.browser.get('/admin/fees');
      assert.equal(res.status, 403);
    } finally {
      await teacher.close();
    }
  });
});
