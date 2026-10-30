import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';

test('主要公開、創作中心與管理頁面都能正常渲染', async () => {
  const harness = await startHarness();
  try {
    const publicPaths = [
      '/',
      '/works',
      '/works?type=novel&sort=trending',
      '/works?tag=%E6%87%B8%E7%96%91&sort=newest',
      '/works/w_inkcity',
      '/works/w_inkcity/chapters/ch_inkcity_1',
      '/creators/u_aurora',
    ];
    for (const path of publicPaths) {
      const res = await harness.browser.follow(path);
      assert.equal(res.status, 200, `公開頁面 ${path} 應回應 200`);
    }

    await harness.browser.login('admin');
    const memberPaths = [
      '/profile',
      '/library',
      '/studio',
      '/studio/works/new',
      '/studio/works/w_inkcity',
      '/studio/works/w_inkcity/edit',
      '/studio/works/w_inkcity/chapters/new',
      '/studio/works/w_inkcity/chapters/ch_inkcity_1/edit',
      '/studio/earnings',
      '/admin',
      '/admin/works',
      '/admin/users',
      '/admin/payouts',
    ];
    for (const path of memberPaths) {
      const res = await harness.browser.follow(path);
      assert.equal(res.status, 200, `登入後頁面 ${path} 應回應 200`);
    }
  } finally {
    await harness.close();
  }
});

test('首頁會累計推流曝光，帶 ref=promo 的點擊會累計點擊數', async () => {
  const harness = await startHarness();
  try {
    const promotion = harness.app.store.data.promotions.find((item) => item.id === 'pr_001');
    assert.ok(promotion !== undefined);
    const impressionsBefore = promotion.impressions;
    const clicksBefore = promotion.clicks;

    await harness.browser.follow('/');
    const afterHome = harness.app.store.data.promotions.find((item) => item.id === 'pr_001');
    assert.ok(afterHome !== undefined);
    assert.equal(afterHome.impressions, impressionsBefore + 1);

    await harness.browser.follow('/works/w_inkcity?ref=promo');
    const afterClick = harness.app.store.data.promotions.find((item) => item.id === 'pr_001');
    assert.ok(afterClick !== undefined);
    assert.equal(afterClick.clicks, clicksBefore + 1);
  } finally {
    await harness.close();
  }
});

test('留言可以刪除，只有留言者或管理員有權限', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('reader');
    const ownComment = await harness.browser.post(
      '/works/w_lantern/comments',
      { body: '這條留言待會要刪除。' },
      '/works/w_lantern',
    );
    assert.equal(ownComment.status, 303);
    const comment = harness.app.store.data.comments.find((item) => item.body === '這條留言待會要刪除。');
    assert.ok(comment !== undefined);

    const blocked = await harness.browser.post(
      '/works/w_lantern/comments/cm_003/delete',
      {},
      '/works/w_lantern',
    );
    assert.equal(blocked.status, 400);
    assert.ok(harness.app.store.data.comments.some((item) => item.id === 'cm_003'));

    const deleted = await harness.browser.post(
      `/works/w_lantern/comments/${comment.id}/delete`,
      {},
      '/works/w_lantern',
    );
    assert.equal(deleted.status, 303);
    assert.equal(harness.app.store.data.comments.some((item) => item.id === comment.id), false);
  } finally {
    await harness.close();
  }
});
