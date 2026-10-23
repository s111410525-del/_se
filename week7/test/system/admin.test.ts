import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from '../helpers.js';

describe('教務管理流程', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('admin');
  });

  after(async () => {
    await h.close();
  });

  test('管理員可以新增課程', async () => {
    const res = await h.browser.post('/admin/courses', {
      code: 'CS450',
      name: '軟體測試',
      englishName: 'Software Testing',
      credits: '3',
      category: '選修',
      term: '115-1',
      teacherId: 'u_tchen',
      capacity: '30',
      location: '資訊大樓 A401',
      day: '5',
      start: '9',
      periods: '1',
      prerequisites: 'CS101、CS210',
    });

    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/admin/courses');

    const course = h.app.store.data.courses.find((item) => item.code === 'CS450');
    assert.ok(course !== undefined);
    assert.equal(course.name, '軟體測試');
    assert.deepEqual(course.prerequisites, ['CS101', 'CS210']);
    assert.equal(course.capacity, 30);
  });

  test('新增的課程會出現在課程查詢頁', async () => {
    const res = await h.browser.get('/courses?q=CS450');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /軟體測試/);
  });

  test('重複的課程代號不會被建立', async () => {
    const before = h.app.store.data.courses.length;
    const res = await h.browser.post('/admin/courses', {
      code: 'CS450',
      name: '重複課程',
      englishName: 'Duplicate',
      credits: '3',
      category: '選修',
      term: '115-1',
      teacherId: 'u_tchen',
      capacity: '10',
      location: 'A101',
      day: '1',
      start: '1',
      periods: '1',
    });
    assert.equal(res.status, 303);
    assert.equal(h.app.store.data.courses.length, before);
  });

  test('管理員可以調整課程名額', async () => {
    const course = h.app.store.data.courses.find((item) => item.code === 'CS450');
    assert.ok(course !== undefined);

    const res = await h.browser.post(`/admin/courses/${course.id}/capacity`, { capacity: '12' });
    assert.equal(res.status, 303);
    assert.equal(
      h.app.store.data.courses.find((item) => item.id === course.id)?.capacity,
      12,
    );
  });

  test('管理員可以切換選課開放狀態', async () => {
    const course = h.app.store.data.courses.find((item) => item.code === 'CS450');
    assert.ok(course !== undefined);
    const before = course.open;

    const res = await h.browser.post(`/admin/courses/${course.id}/toggle`);
    assert.equal(res.status, 303);
    assert.equal(
      h.app.store.data.courses.find((item) => item.id === course.id)?.open,
      !before,
    );
  });

  test('管理員可以發布置頂公告', async () => {
    const res = await h.browser.post('/admin/notices', {
      title: '系統測試公告',
      category: '公告',
      body: '這是由系統測試建立的公告。',
      pinned: '1',
    });
    assert.equal(res.status, 303);

    const notice = h.app.store.data.notices.find((item) => item.title === '系統測試公告');
    assert.ok(notice !== undefined);
    assert.equal(notice.pinned, true);

    const list = await h.browser.get('/notices');
    assert.match(await list.text(), /系統測試公告/u);
  });

  test('管理員可以取消置頂並刪除公告', async () => {
    const notice = h.app.store.data.notices.find((item) => item.title === '系統測試公告');
    assert.ok(notice !== undefined);

    const pin = await h.browser.post(`/admin/notices/${notice.id}/pin`);
    assert.equal(pin.status, 303);
    assert.equal(
      h.app.store.data.notices.find((item) => item.id === notice.id)?.pinned,
      false,
    );

    const removed = await h.browser.post(`/admin/notices/${notice.id}/delete`);
    assert.equal(removed.status, 303);
    assert.equal(h.app.store.data.notices.some((item) => item.id === notice.id), false);
  });

  test('使用者名冊與系統動態頁可以開啟', async () => {
    const users = await h.browser.get('/admin/users?role=teacher');
    assert.equal(users.status, 200);
    assert.match(await users.text(), /陳鍾誠/);

    const activity = await h.browser.get('/admin/activity');
    assert.equal(activity.status, 200);
    assert.match(await activity.text(), /最近繳費紀錄/);
  });

  test('學生不能呼叫管理員的 API', async () => {
    const student = await startHarness();
    try {
      await student.browser.login('s001');
      const res = await student.browser.post('/admin/notices', {
        title: '不該成功',
        category: '公告',
        body: '學生沒有權限',
      });
      assert.equal(res.status, 403);
    } finally {
      await student.close();
    }
  });
});
