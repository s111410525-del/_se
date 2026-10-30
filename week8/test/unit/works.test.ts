import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import {
  canViewWork,
  chaptersOf,
  createChapter,
  createWork,
  deleteChapter,
  filterWorks,
  needWork,
} from '../../src/services/works.js';
import type { WorkInput } from '../../src/types.js';

const NOW = '2026-10-30T00:00:00.000Z';

const INPUT: WorkInput = {
  title: '測試作品',
  synopsis: '這是一部測試作品。',
  type: 'novel',
  tags: ['測試', '短篇'],
  cover: '🧪',
  status: 'serializing',
  published: true,
};

test('未公開作品只有作者與管理員看得到', () => {
  const db = createSeedDatabase();
  const draft = needWork(db, 'w_draft');
  const owner = db.users.find((user) => user.id === draft.creatorId);
  const admin = db.users.find((user) => user.role === 'admin');
  const reader = db.users.find((user) => user.username === 'reader');
  assert.ok(owner !== undefined && admin !== undefined && reader !== undefined);

  assert.equal(canViewWork(draft, owner), true);
  assert.equal(canViewWork(draft, admin), true);
  assert.equal(canViewWork(draft, reader), false);
  assert.equal(canViewWork(draft, undefined), false);
});

test('章節依 order 排序，刪除後會重新編號', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_inkcity');
  assert.deepEqual(chaptersOf(db, work.id).map((chapter) => chapter.order), [1, 2, 3]);

  deleteChapter(db, work, 'ch_inkcity_2', NOW);
  const left = chaptersOf(db, work.id);
  assert.deepEqual(left.map((chapter) => chapter.order), [1, 2]);
  assert.deepEqual(left.map((chapter) => chapter.title), [
    '第一章：雨夜的第十三號門牌',
    '第三章：天亮之前的訪客',
  ]);
  assert.equal(work.updatedAt, NOW);
});

test('新作品與新章節會取得遞增的章節編號', () => {
  const db = createSeedDatabase();
  const creator = db.users.find((user) => user.username === 'novice');
  assert.ok(creator !== undefined);

  const work = createWork(db, creator, INPUT, NOW);
  assert.equal(work.views, 0);
  assert.equal(chaptersOf(db, work.id).length, 0);

  const first = createChapter(db, work, { title: '第一章', content: '內容', imageUrls: [] }, NOW);
  const second = createChapter(db, work, { title: '第二章', content: '內容', imageUrls: [] }, NOW);
  assert.equal(first.order, 1);
  assert.equal(second.order, 2);
  assert.equal(work.updatedAt, NOW);
});

test('作品篩選支援類型、標籤、關鍵字與排序', () => {
  const db = createSeedDatabase();
  const publicWorks = db.works.filter((work) => work.published);

  const comics = filterWorks(db, publicWorks, { type: 'comic' });
  assert.ok(comics.length > 0);
  assert.ok(comics.every((work) => work.type === 'comic'));

  const suspense = filterWorks(db, publicWorks, { tag: '懸疑' });
  assert.deepEqual(suspense.map((work) => work.id).sort(), ['w_inkcity', 'w_tear']);

  const keyword = filterWorks(db, publicWorks, { q: '提燈' });
  assert.deepEqual(keyword.map((work) => work.id), ['w_lantern']);

  const newest = filterWorks(db, publicWorks, { sort: 'newest' });
  for (let i = 1; i < newest.length; i += 1) {
    const previous = newest[i - 1];
    const current = newest[i];
    assert.ok(previous !== undefined && current !== undefined);
    assert.ok(Date.parse(previous.updatedAt) >= Date.parse(current.updatedAt));
  }
});
