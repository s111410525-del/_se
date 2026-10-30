import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';

test('管理員可以設定精選與替免費作品開啟推流', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('admin');
    const dashboard = await harness.browser.follow('/admin');
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /平台管理/);

    const feature = await harness.browser.post('/admin/works/w_robot/feature', {}, '/admin/works');
    assert.equal(feature.status, 303);
    const robot = harness.app.store.data.works.find((work) => work.id === 'w_robot');
    assert.ok(robot !== undefined);
    assert.equal(robot.featured, true);

    const featureAgain = await harness.browser.post('/admin/works/w_robot/feature', {}, '/admin/works');
    assert.equal(featureAgain.status, 303);
    assert.equal(harness.app.store.data.works.find((work) => work.id === 'w_robot')?.featured, false);

    const promote = await harness.browser.post('/admin/works/w_tear/promote', {}, '/admin/works');
    assert.equal(promote.status, 303);
    const promotion = harness.app.store.data.promotions.find(
      (item) => item.workId === 'w_tear' && item.source === 'admin',
    );
    assert.ok(promotion !== undefined);
    const days = (Date.parse(promotion.expiresAt) - Date.parse(promotion.startedAt)) / 86_400_000;
    assert.equal(Math.round(days), 14);
  } finally {
    await harness.close();
  }
});

test('管理員可以審核撥款', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('admin');
    const payouts = await harness.browser.follow('/admin/payouts');
    assert.equal(payouts.status, 200);
    assert.match(await payouts.text(), /撥款審核/);

    const approve = await harness.browser.post('/admin/payouts/wd_001', { status: 'paid' }, '/admin/payouts');
    assert.equal(approve.status, 303);
    const withdrawal = harness.app.store.data.withdrawals.find((item) => item.id === 'wd_001');
    assert.ok(withdrawal !== undefined);
    assert.equal(withdrawal.status, 'paid');
    assert.ok(withdrawal.processedAt !== null);

    const invalid = await harness.browser.post('/admin/payouts/wd_002', { status: 'unknown' }, '/admin/payouts');
    assert.equal(invalid.status, 400);
  } finally {
    await harness.close();
  }
});

test('一般會員不能進入管理區', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('reader');
    const dashboard = await harness.browser.get('/admin');
    assert.equal(dashboard.status, 403);
    const payouts = await harness.browser.get('/admin/payouts');
    assert.equal(payouts.status, 403);
  } finally {
    await harness.close();
  }
});
