import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';

test('首頁、職缺列表、靜態資源與健康檢查可以匿名存取', async () => {
  const harness = await startHarness();
  try {
    const home = await harness.browser.get('/');
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /職光/);
    assert.match(homeHtml, /曝光/);
    assert.match(homeHtml, /瀏覽工作內容、要求與預設月薪/);

    const jobs = await harness.browser.get('/jobs');
    assert.equal(jobs.status, 200);
    assert.match(await jobs.text(), /找工作/);

    const seeded = harness.app.store.data.jobs.find((job) => job.published);
    assert.ok(seeded !== undefined);
    const detail = await harness.browser.get(`/jobs/${encodeURIComponent(seeded.id)}`);
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), new RegExp(seeded.title));

    const css = await harness.browser.get('/assets/app.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') ?? '', /text\/css/);

    const script = await harness.browser.get('/assets/app.js');
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type') ?? '', /javascript/);

    const health = await harness.browser.get('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: 'jobbeam' });
  } finally {
    await harness.close();
  }
});

test('匿名使用者會被導向登入頁，求職者不能進入企業或管理頁', async () => {
  const harness = await startHarness();
  try {
    const employer = await harness.browser.get('/employer');
    assert.equal(employer.status, 303);
    assert.match(employer.headers.get('location') ?? '', /^\/login\?next=/);

    const login = await harness.browser.get('/login');
    assert.equal(login.status, 200);
    assert.match(await login.text(), /示範帳號/);

    const register = await harness.browser.get('/register');
    assert.equal(register.status, 200);
    assert.match(await register.text(), /免費註冊/);

    await harness.browser.login('lena');
    const wallet = await harness.browser.get('/wallet');
    assert.equal(wallet.status, 403);
    assert.match(await wallet.text(), /沒有權限/);

    const admin = await harness.browser.get('/admin');
    assert.equal(admin.status, 403);
  } finally {
    await harness.close();
  }
});

test('不存在的頁面與職缺會顯示 404 錯誤頁', async () => {
  const harness = await startHarness();
  try {
    const page = await harness.browser.get('/not-a-real-page');
    assert.equal(page.status, 404);
    assert.match(await page.text(), /找不到頁面/);

    const job = await harness.browser.get('/jobs/job_missing');
    assert.equal(job.status, 404);
  } finally {
    await harness.close();
  }
});
