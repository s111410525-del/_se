import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from '../helpers.js';

describe('HTTP 介面', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
  });

  after(async () => {
    await h.close();
  });

  test('健康檢查端點回傳 JSON', async () => {
    const res = await h.browser.get('/health');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/u);
    assert.match(res.headers.get('cache-control') ?? '', /no-store/u);

    const payload = (await res.json()) as { ok: boolean; term: string };
    assert.equal(payload.ok, true);
    assert.equal(payload.term, '115-1');
  });

  test('靜態 CSS 與 JS 可以取得且可快取', async () => {
    const css = await h.browser.get('/assets/app.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') ?? '', /text\/css/u);
    assert.match(css.headers.get('cache-control') ?? '', /max-age=3600/u);
    assert.ok((await css.text()).length > 100);

    const js = await h.browser.get('/assets/app.js');
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type') ?? '', /application\/javascript/u);
    assert.ok((await js.text()).length > 100);
  });

  test('回應包含基本安全標頭', async () => {
    const res = await h.browser.get('/login');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'same-origin');
  });

  test('登入頁的 Cookie 具備 HttpOnly 與 SameSite', async () => {
    const fresh = await startHarness();
    try {
      const res = await fresh.browser.get('/login');
      const cookie = res.headers.getSetCookie().find((item) => item.startsWith('nqu_session='));
      assert.ok(cookie !== undefined);
      assert.match(cookie, /HttpOnly/u);
      assert.match(cookie, /SameSite=Lax/u);
    } finally {
      await fresh.close();
    }
  });

  test('未知路徑回傳 404 錯誤頁', async () => {
    const res = await h.browser.get('/no-such-page');
    assert.equal(res.status, 404);
    assert.match(await res.text(), /404/);
  });

  test('不支援的方法回傳 405 並列出可用方法', async () => {
    const res = await h.browser.get('/health');
    assert.equal(res.status, 200);

    const body = new URLSearchParams();
    const wrong = await fetch(`${h.url}/health`, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
    });
    assert.equal(wrong.status, 405);
    assert.match(await wrong.text(), /可用方法：GET/u);
  });
});
