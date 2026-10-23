import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from '../helpers.js';

describe('個人資料與公告', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('s001');
  });

  after(async () => {
    await h.close();
  });

  test('公告列表與詳情頁可以瀏覽', async () => {
    const list = await h.browser.get('/notices');
    assert.equal(list.status, 200);
    assert.match(await list.text(), /選課系統開放公告/);

    const detail = await h.browser.get('/notices/n_001');
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /每學期修課上限 25 學分/);
  });

  test('公告可以用關鍵字搜尋', async () => {
    const res = await h.browser.get('/notices?q=%E6%A9%9F%E6%88%BF');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /資訊大樓機房維護/u);
    assert.doesNotMatch(html, /專題實務課程說明會/u);
  });

  test('學生可以更新個人資料', async () => {
    const res = await h.browser.post('/profile', {
      name: '陳測試',
      email: 'test@student.nqu.edu.tw',
      phone: '0912-345-678',
      address: '金門縣金城鎮測試路 1 號',
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/profile');

    const user = h.app.store.data.users.find((item) => item.id === 'u_s001');
    assert.equal(user?.name, '陳測試');
    assert.equal(user?.email, 'test@student.nqu.edu.tw');

    const page = await h.browser.get('/profile');
    const html = await page.text();
    assert.match(html, /陳測試/);
    assert.match(html, /測試路 1 號/);
  });

  test('電子郵件格式錯誤時顯示錯誤且不更新', async () => {
    const before = h.app.store.data.users.find((item) => item.id === 'u_s001')?.email;
    const res = await h.browser.post('/profile', {
      name: '陳測試',
      email: 'not-an-email',
      phone: '0912-345-678',
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /電子郵件格式不正確/);
    assert.equal(h.app.store.data.users.find((item) => item.id === 'u_s001')?.email, before);
  });

  test('登出後個人資料頁會導向登入頁', async () => {
    const out = await h.browser.post('/logout');
    assert.equal(out.status, 303);

    const res = await h.browser.get('/profile');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login');
  });
});
