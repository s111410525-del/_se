import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from './helpers.js';

describe('登入與權限', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
  });

  after(async () => {
    await h.close();
  });

  test('未登入者造訪首頁會被導向登入頁', async () => {
    const res = await h.browser.get('/');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login');
  });

  test('登入頁會發出工作階段 Cookie 與 CSRF 權杖', async () => {
    const fresh = await startHarness();
    try {
      const res = await fresh.browser.get('/login');
      assert.equal(res.status, 200);
      assert.match(await res.text(), /name="_csrf"/);
      assert.ok(res.headers.getSetCookie().some((cookie) => cookie.startsWith('nqu_session=')));
    } finally {
      await fresh.close();
    }
  });

  test('密碼錯誤回應 401 且不建立登入狀態', async () => {
    const res = await h.browser.login('s001', 'wrong-password');
    assert.equal(res.status, 401);
    assert.equal(h.browser.loggedIn, false);
    assert.match(await res.text(), /帳號或密碼錯誤/);
  });

  test('缺少 CSRF 權杖的表單會被擋下', async () => {
    const res = await h.browser.postWithoutCsrf('/login', { username: 's001', password: 'nqu1234' });
    assert.equal(res.status, 403);
  });

  test('正確帳密可以登入學生帳號', async () => {
    const res = await h.browser.login('s001');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/');
    assert.equal(h.browser.loggedIn, true);

    const home = await h.browser.get('/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /陳秉硯/);
  });

  test('學生不能進入管理頁面', async () => {
    const res = await h.browser.get('/admin');
    assert.equal(res.status, 403);
  });

  test('學生不能使用教師的課表頁以外的成績管理功能', async () => {
    const res = await h.browser.get('/grades/course/c_cs101');
    assert.equal(res.status, 403);
  });

  test('登出後回到未登入狀態', async () => {
    const res = await h.browser.post('/logout');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login');
    assert.equal(h.browser.loggedIn, false);
  });
});

describe('管理員權限', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('admin');
  });

  after(async () => {
    await h.close();
  });

  test('管理員可以進入教務管理頁面', async () => {
    const res = await h.browser.get('/admin');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /教務管理/);
  });

  test('管理員可以查閱任何課程的名單（教師則不行）', async () => {
    const res = await h.browser.get('/grades/course/c_cs101');
    assert.equal(res.status, 200);
  });

  test('管理員可以查看成績總覽', async () => {
    const res = await h.browser.get('/admin/grades');
    assert.equal(res.status, 200);
  });

  test('管理員可以發布公告', async () => {
    const res = await h.browser.post('/admin/notices', {
      title: '測試公告',
      category: '公告',
      body: '這是一則由測試建立的公告。',
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/notices');

    const list = await h.browser.get('/notices');
    assert.match(await list.text(), /測試公告/);
  });

  test('管理員可以切換課程的選課開放狀態', async () => {
    const before = h.app.store.data.courses.find((course) => course.id === 'c_ge101')?.open;
    assert.ok(before !== undefined);

    const res = await h.browser.post('/admin/courses/c_ge101/toggle');
    assert.equal(res.status, 303);
    const after = h.app.store.data.courses.find((course) => course.id === 'c_ge101')?.open;
    assert.equal(after, !before);
  });
});

describe('教師權限', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('tchen');
  });

  after(async () => {
    await h.close();
  });

  test('教師只看到自己開的課程', async () => {
    const res = await h.browser.get('/grades');
    const html = await res.text();
    assert.match(html, /CS101/);
    assert.doesNotMatch(html, /CS305/);
  });

  test('教師不能管理其他教師的課程', async () => {
    const res = await h.browser.get('/grades/course/c_cs305');
    assert.equal(res.status, 403);
  });

  test('教師不能進入選課頁', async () => {
    const res = await h.browser.get('/enrollment');
    assert.equal(res.status, 403);
  });
});
