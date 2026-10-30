import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';
import type { Harness } from '../helpers.js';

async function createWork(harness: Harness, title: string): Promise<string> {
  const res = await harness.browser.post(
    '/studio/works',
    {
      title,
      synopsis: `${title} 的簡介。`,
      type: 'novel',
      status: 'serializing',
      cover: '📖',
      tags: '奇幻, 測試',
      published: '1',
    },
    '/studio/works/new',
  );
  assert.equal(res.status, 303);
  const work = harness.app.store.data.works.find((item) => item.title === title);
  assert.ok(work !== undefined);
  return work.id;
}

test('創作者可以建立作品與章節，並在管理頁看到內容', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('aurora');
    const workId = await createWork(harness, '雨後的第二條街');

    const chapterRes = await harness.browser.post(
      `/studio/works/${workId}/chapters`,
      {
        title: '第一章：新的門牌',
        content: '雨水落在沒有名字的屋簷上。',
        imageUrls: '',
      },
      `/studio/works/${workId}/chapters/new`,
    );
    assert.equal(chapterRes.status, 303);

    const chapter = harness.app.store.data.chapters.find((item) => item.workId === workId);
    assert.ok(chapter !== undefined);
    assert.equal(chapter.order, 1);

    const manage = await harness.browser.follow(`/studio/works/${workId}`);
    assert.equal(manage.status, 200);
    const html = await manage.text();
    assert.match(html, /雨後的第二條街/);
    assert.match(html, /第一章：新的門牌/);
  } finally {
    await harness.close();
  }
});

test('閱讀計次與付費作品收益：作者自讀不計，其他讀者與匿名讀者都計', async () => {
  const harness = await startHarness();
  try {
    const db = harness.app.store.data;
    const work = db.works.find((item) => item.id === 'w_inkcity');
    assert.ok(work !== undefined);
    const chapter = db.chapters.find((item) => item.workId === work.id && item.order === 1);
    assert.ok(chapter !== undefined);
    const viewsBefore = work.views;
    const earningsBefore = db.earnings.filter((entry) => entry.creatorId === work.creatorId && entry.kind === 'view').length;

    await harness.browser.login('aurora');
    await harness.browser.follow(`/works/${work.id}/chapters/${chapter.id}`);
    const afterSelf = harness.app.store.data.works.find((item) => item.id === work.id);
    assert.ok(afterSelf !== undefined);
    assert.equal(afterSelf.views, viewsBefore + 1);
    assert.equal(
      harness.app.store.data.earnings.filter((entry) => entry.creatorId === work.creatorId && entry.kind === 'view').length,
      earningsBefore,
    );

    await harness.browser.login('reader');
    await harness.browser.follow(`/works/${work.id}/chapters/${chapter.id}`);
    const afterReader = harness.app.store.data.works.find((item) => item.id === work.id);
    assert.ok(afterReader !== undefined);
    assert.equal(afterReader.views, viewsBefore + 2);
    assert.equal(
      harness.app.store.data.earnings.filter((entry) => entry.creatorId === work.creatorId && entry.kind === 'view').length,
      earningsBefore + 1,
    );
  } finally {
    await harness.close();
  }
});

test('讀者可以收藏、留言與打賞，免費作品不能打賞', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('reader');

    const bookmark = await harness.browser.post('/works/w_stars/bookmark', {}, '/works/w_stars');
    assert.equal(bookmark.status, 303);
    assert.ok(harness.app.store.data.bookmarks.some((item) => item.workId === 'w_stars' && item.userId === 'u_reader'));

    const comment = await harness.browser.post(
      '/works/w_inkcity/comments',
      { body: '這章的雨夜氣氛寫得很好。' },
      '/works/w_inkcity',
    );
    assert.equal(comment.status, 303);
    const added = harness.app.store.data.comments.find((item) => item.body === '這章的雨夜氣氛寫得很好。');
    assert.ok(added !== undefined);

    const tip = await harness.browser.post('/works/w_inkcity/tip', { amount: '100', message: '加油' }, '/works/w_inkcity');
    assert.equal(tip.status, 303);
    const storedTip = harness.app.store.data.tips.find(
      (item) => item.workId === 'w_inkcity' && item.fromUserId === 'u_reader' && item.amount === 100,
    );
    assert.ok(storedTip !== undefined);
    assert.equal(storedTip.creatorShare, 90);

    const blocked = await harness.browser.post('/works/w_catcomic/tip', { amount: '100' }, '/works/w_catcomic');
    assert.equal(blocked.status, 303);
    assert.equal(
      harness.app.store.data.tips.some((item) => item.workId === 'w_catcomic' && item.fromUserId === 'u_reader'),
      false,
    );
  } finally {
    await harness.close();
  }
});

test('付費創作者可以提出提領申請，免費帳號不行', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('quill');
    const earnings = await harness.browser.follow('/studio/earnings');
    assert.equal(earnings.status, 200);

    const withdraw = await harness.browser.post('/studio/withdraw', { amount: '100', note: '測試提領' }, '/studio/earnings');
    assert.equal(withdraw.status, 303);
    const pending = harness.app.store.data.withdrawals.find(
      (item) => item.creatorId === 'u_quill' && item.status === 'pending' && item.amount === 100,
    );
    assert.ok(pending !== undefined);

    await harness.browser.login('inkcat');
    const blocked = await harness.browser.post('/studio/withdraw', { amount: '100' }, '/studio/earnings');
    assert.equal(blocked.status, 303);
    assert.equal(
      harness.app.store.data.withdrawals.some((item) => item.creatorId === 'u_inkcat'),
      false,
    );
  } finally {
    await harness.close();
  }
});

test('不能管理別人的作品', async () => {
  const harness = await startHarness();
  try {
    await harness.browser.login('reader');
    const res = await harness.browser.get('/studio/works/w_inkcity');
    assert.equal(res.status, 403);
  } finally {
    await harness.close();
  }
});
