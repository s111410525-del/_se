import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from './helpers.js';

function findRow(h: Harness, studentId: string, courseId: string) {
    return h.app.store.data.enrollments.find(
      (row) => row.studentId === studentId && row.courseId === courseId && row.status !== 'dropped',
    );
}

/** 包含已退選的紀錄，用來驗證退選真的有寫回資料。 */
function findAnyRow(h: Harness, studentId: string, courseId: string) {
    return h.app.store.data.enrollments.find((row) => row.studentId === studentId && row.courseId === courseId);
}

describe('學生選課', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('s001');
  });

  after(async () => {
    await h.close();
  });

  test('可以選修有餘額的課程', async () => {
    const res = await h.browser.post('/enrollment/c_cs399');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/enrollment');
    assert.equal(findRow(h, 'u_s001', 'c_cs399')?.status, 'enrolled');
  });

  test('重複選課會被擋下', async () => {
    const res = await h.browser.post('/enrollment/c_cs399');
    assert.equal(res.status, 409);
    assert.match(await res.text(), /已經選過/);
  });

  test('已在候補名單中不可重複選課', async () => {
    const res = await h.browser.post('/enrollment/c_cs330');
    assert.equal(res.status, 409);
    assert.match(await res.text(), /候補名單/);
  });

  test('衝堂的課程無法選修', async () => {
    // CS330（週二、週四 5-6 節）與 CS305 同時段。
    const res = await h.browser.post('/enrollment/c_cs305');
    assert.equal(res.status, 409);
    assert.match(await res.text(), /衝堂/);
  });

  test('先修條件未達成時無法選修', async () => {
    // CS320 需要先修 CS305，s001 並未修過。
    const res = await h.browser.post('/enrollment/c_cs320');
    assert.equal(res.status, 409);
    assert.match(await res.text(), /先修/);
  });

  test('選課頁顯示候補名單', async () => {
    const res = await h.browser.get('/enrollment');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /候補/);
  });
});

describe('候補遞補', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('s001');
  });

  after(async () => {
    await h.close();
  });

  test('名額已滿時會排入候補', async () => {
    // 種子資料：CS330 名額 4 席，s002～s005 已選滿，s001 候補第 1 位。
    const row = findRow(h, 'u_s001', 'c_cs330');
    assert.equal(row?.status, 'waitlisted');
    assert.equal(row?.queue, 1);
  });

  test('有人退選時候補第一位自動遞補為正取', async () => {
    const res = await h.browser.login('s002');
    assert.equal(res.status, 303);

    const dropped = await h.browser.post('/enrollment/c_cs330/drop');
    assert.equal(dropped.status, 303);
    assert.equal(findAnyRow(h, 'u_s002', 'c_cs330')?.status, 'dropped');
    assert.equal(findRow(h, 'u_s001', 'c_cs330')?.status, 'enrolled');
  });

  test('遞補後候補清單為空', async () => {
    const waiting = h.app.store.data.enrollments.filter(
      (row) => row.courseId === 'c_cs330' && row.status === 'waitlisted',
    );
    assert.equal(waiting.length, 0);
  });
});

describe('學分上限', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('s001');
  });

  after(async () => {
    await h.close();
  });

  test('超過學分上限時無法加選', async () => {
    h.app.services.config.creditLimit = 1;
    try {
      const res = await h.browser.post('/enrollment/c_cs399');
      assert.equal(res.status, 409);
      assert.match(await res.text(), /學分上限/);
    } finally {
      h.app.services.config.creditLimit = 25;
    }
  });
});
