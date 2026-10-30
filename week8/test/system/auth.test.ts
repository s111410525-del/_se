import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';

test('首頁、靜態資源與健康檢查可以匿名存取', async () => {
  const harness = await startHarness();
  try {
    const home = await harness.browser.get('/');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /墨流/);
    assert.match(html, /系統推流/);

    const css = await harness.browser.get('/assets/app.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') ?? '', /text\/css/);

    const health = await harness.browser.get('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'inkflow' });
  } finally {
    await harness.close();
  }
});

test('沒有 CSRF 權杖的 POST 會被拒絕', async () => {
  const harness = await startHarness();
  try {
    const res = await harness.browser.postWithoutCsrf('/login', {
      username: 'aurora',
      password: 'ink1234',
    });
    assert.equal(res.status, 403);
    assert.match(await res.text(), /安全驗證失敗/);
  } finally {
    await harness.close();
  }
});

test('註冊後會自動登入，登出後需重新登入', async () => {
  const harness = await startHarness();
  try {
    const register = await harness.browser.post(
      '/register',
      {
        username: 'newscribe',
        name: '新筆',
        email: 'newscribe@example.com',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(register.status, 303);
    assert.equal(register.headers.get('location'), '/studio');

    const created = harness.app.store.data.users.find((user) => user.username === 'newscribe');
    assert.ok(created !== undefined);
    assert.equal(created.role, 'member');
    assert.equal(created.plan, 'free');

    const studio = await harness.browser.follow('/studio');
    assert.equal(studio.status, 200);
    assert.match(await studio.text(), /創作中心/);

    const logout = await harness.browser.post('/logout', {}, '/studio');
    assert.equal(logout.status, 303);
    assert.equal(logout.headers.get('location'), '/login');

    const blocked = await harness.browser.get('/studio');
    assert.equal(blocked.status, 303);
    assert.equal(blocked.headers.get('location'), '/login');

    const wrong = await harness.browser.login('newscribe', 'wrong-password');
    assert.equal(wrong.status, 401);

    const login = await harness.browser.login('newscribe', 'password1');
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/');
  } finally {
    await harness.close();
  }
});

test('重複的使用者名稱會回報衝突', async () => {
  const harness = await startHarness();
  try {
    const res = await harness.browser.post(
      '/register',
      {
        username: 'aurora',
        name: '冒牌極光',
        email: 'fake@example.com',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(res.status, 409);
    assert.match(await res.text(), /已經有人使用/);
  } finally {
    await harness.close();
  }
});

test('免費帳號升級付費方案後，已公開作品會取得方案推流', async () => {
  const harness = await startHarness();
  try {
    const register = await harness.browser.post(
      '/register',
      {
        username: 'upgrader',
        name: '升級者',
        email: 'upgrader@example.com',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(register.status, 303);

    const create = await harness.browser.post(
      '/studio/works',
      {
        title: '升級前的作品',
        synopsis: '這部作品會在升級後獲得推流。',
        type: 'novel',
        status: 'serializing',
        cover: '🚀',
        tags: '奇幻, 測試',
        published: '1',
      },
      '/studio/works/new',
    );
    assert.equal(create.status, 303);

    const user = harness.app.store.data.users.find((item) => item.username === 'upgrader');
    assert.ok(user !== undefined);
    const work = harness.app.store.data.works.find((item) => item.creatorId === user.id);
    assert.ok(work !== undefined);
    assert.equal(harness.app.store.data.promotions.some((promotion) => promotion.workId === work.id), false);

    const upgrade = await harness.browser.post('/account/plan', { plan: 'pro' }, '/profile');
    assert.equal(upgrade.status, 303);

    const upgraded = harness.app.store.data.users.find((item) => item.id === user.id);
    assert.ok(upgraded !== undefined);
    assert.equal(upgraded.plan, 'pro');
    assert.ok(
      harness.app.store.data.promotions.some(
        (promotion) => promotion.workId === work.id && promotion.source === 'plan',
      ),
    );
  } finally {
    await harness.close();
  }
});
