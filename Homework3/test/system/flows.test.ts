import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, type Browser } from '../helpers.js';

const JOB_FIELDS = {
  title: '測試全端工程師',
  category: 'tech',
  employmentType: 'full-time',
  location: '台北市內湖區',
  salaryMin: '70000',
  salaryMax: '100000',
  salaryNote: '保障年薪 14 個月',
  tags: 'TypeScript, Node.js, PostgreSQL',
  description: '負責開發與維護職光平台的前後端功能。',
  requirements: '三年以上 Web 開發經驗，熟悉 TypeScript。',
  benefits: '彈性工時、遠端日、教育訓練補助。',
  published: '1',
};

async function loginAs(browser: Browser, username: string): Promise<void> {
  const res = await browser.login(username);
  assert.equal(res.status, 303);
}

async function logout(browser: Browser, csrfFrom: string): Promise<void> {
  const res = await browser.post('/logout', {}, csrfFrom);
  assert.equal(res.status, 303);
}

test('企業刊登、購買曝光、求職者私訊應徵、企業回覆與儲值的完整流程', async () => {
  const harness = await startHarness();
  try {
    await loginAs(harness.browser, 'dean');

    const create = await harness.browser.post('/employer/jobs/new', JOB_FIELDS, '/employer/jobs/new');
    assert.equal(create.status, 303);
    assert.equal(create.headers.get('location'), '/employer');

    const job = harness.app.store.data.jobs.find((item) => item.title === JOB_FIELDS.title);
    assert.ok(job !== undefined);
    assert.equal(job.employerId, 'u_dean');
    assert.deepEqual(job.tags, ['TypeScript', 'Node.js', 'PostgreSQL']);
    assert.equal(job.salaryMin, 70000);
    assert.equal(job.salaryMax, 100000);

    const employer = harness.app.store.data.users.find((item) => item.id === 'u_dean');
    assert.ok(employer !== undefined);
    const beforePromotion = employer.balance;
    const promote = await harness.browser.post(
      `/employer/jobs/${encodeURIComponent(job.id)}/promote`,
      { days: '7' },
      '/employer',
    );
    assert.equal(promote.status, 303);
    const promotion = harness.app.store.data.promotions.find((item) => item.jobId === job.id);
    assert.ok(promotion !== undefined);
    assert.equal(promotion.source, 'wallet');
    assert.equal(employer.balance, beforePromotion - 299);

    await logout(harness.browser, '/employer');
    await loginAs(harness.browser, 'lena');

    const detail = await harness.browser.get(`/jobs/${encodeURIComponent(job.id)}`);
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /應徵這個職缺/);

    const apply = await harness.browser.post(
      `/jobs/${encodeURIComponent(job.id)}/apply`,
      { body: '你好，我有三年 TypeScript 經驗，想進一步了解團隊。' },
      `/jobs/${encodeURIComponent(job.id)}`,
    );
    assert.equal(apply.status, 303);
    assert.match(apply.headers.get('location') ?? '', /^\/messages\//);

    const conversation = harness.app.store.data.conversations.find(
      (item) => item.jobId === job.id && item.seekerId === 'u_lena',
    );
    assert.ok(conversation !== undefined);
    assert.equal(conversation.employerId, 'u_dean');
    assert.equal(conversation.status, 'applied');

    const message = await harness.browser.post(
      `/messages/${encodeURIComponent(conversation.id)}`,
      { body: '附上我的作品集，再麻煩您參考。' },
      `/messages/${encodeURIComponent(conversation.id)}`,
    );
    assert.equal(message.status, 303);

    await logout(harness.browser, `/messages/${encodeURIComponent(conversation.id)}`);
    await loginAs(harness.browser, 'dean');

    const thread = await harness.browser.get(`/messages/${encodeURIComponent(conversation.id)}`);
    assert.equal(thread.status, 200);
    assert.match(await thread.text(), /作品集/);

    const reply = await harness.browser.post(
      `/messages/${encodeURIComponent(conversation.id)}`,
      { body: '收到，邀請你下週來面談。' },
      `/messages/${encodeURIComponent(conversation.id)}`,
    );
    assert.equal(reply.status, 303);

    const status = await harness.browser.post(
      `/messages/${encodeURIComponent(conversation.id)}/status`,
      { status: 'invited' },
      `/messages/${encodeURIComponent(conversation.id)}`,
    );
    assert.equal(status.status, 303);
    assert.equal(conversation.status, 'invited');

    const beforeTopup = employer.balance;
    const topup = await harness.browser.post(
      '/wallet/topup',
      { amount: '600', method: '信用卡（模擬）' },
      '/wallet',
    );
    assert.equal(topup.status, 303);
    assert.equal(employer.balance, beforeTopup + 600);
    assert.ok(
      harness.app.store.data.topups.some(
        (item) => item.userId === 'u_dean' && item.amount === 600,
      ),
    );

    const inbox = await harness.browser.get('/messages');
    assert.equal(inbox.status, 200);
    assert.match(await inbox.text(), /測試全端工程師/);
  } finally {
    await harness.close();
  }
});

test('管理員可以查看營運頁面、贈送曝光與切換職缺狀態', async () => {
  const harness = await startHarness();
  try {
    await loginAs(harness.browser, 'admin');

    for (const path of ['/admin', '/admin/users', '/admin/jobs', '/admin/transactions']) {
      const res = await harness.browser.get(path);
      assert.equal(res.status, 200, `${path} 應可存取`);
    }

    const db = harness.app.store.data;
    const job = db.jobs.find(
      (item) => item.published && !db.promotions.some((promotion) => promotion.jobId === item.id),
    );
    assert.ok(job !== undefined);

    const promote = await harness.browser.post(
      `/admin/jobs/${encodeURIComponent(job.id)}/promote`,
      {},
      '/admin/jobs',
    );
    assert.equal(promote.status, 303);
    const promotion = db.promotions.find((item) => item.jobId === job.id);
    assert.ok(promotion !== undefined);
    assert.equal(promotion.source, 'admin');
    assert.equal(promotion.amount, 0);

    const close = await harness.browser.post(
      `/admin/jobs/${encodeURIComponent(job.id)}/visibility`,
      { published: '0' },
      '/admin/jobs',
    );
    assert.equal(close.status, 303);
    assert.equal(job.published, false);

    const open = await harness.browser.post(
      `/admin/jobs/${encodeURIComponent(job.id)}/visibility`,
      { published: '1' },
      '/admin/jobs',
    );
    assert.equal(open.status, 303);
    assert.equal(job.published, true);
  } finally {
    await harness.close();
  }
});
