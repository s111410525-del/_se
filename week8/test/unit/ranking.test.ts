import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import { activePromotion } from '../../src/services/promotion.js';
import { newestWorks, promotionPicks, recommendedWorks, scoreOfWork, trendingWorks } from '../../src/services/ranking.js';
import { needWork } from '../../src/services/works.js';

test('進行中的推流會提高作品推薦分數', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_inkcity');
  const now = Date.now();
  const withPromotion = scoreOfWork(db, work, now);
  db.promotions = db.promotions.filter((promotion) => promotion.workId !== work.id);
  const withoutPromotion = scoreOfWork(db, work, now);
  assert.ok(withPromotion > withoutPromotion);
  assert.equal(activePromotion(db, work.id, now), undefined);
});

test('首頁推流區只挑選有進行中推流的作品', () => {
  const db = createSeedDatabase();
  const publicWorks = db.works.filter((work) => work.published);
  const picks = promotionPicks(db, publicWorks, Date.now(), 4);
  const ids = picks.map((work) => work.id).sort();
  assert.deepEqual(ids, ['w_inkcity', 'w_lantern']);
});

test('熱門排序以閱讀數為主要依據', () => {
  const db = createSeedDatabase();
  const publicWorks = db.works.filter((work) => work.published);
  const top = trendingWorks(db, publicWorks, 1)[0];
  assert.equal(top?.id, 'w_inkcity');
});

test('推薦排序會把精選與推流作品放在前段', () => {
  const db = createSeedDatabase();
  const publicWorks = db.works.filter((work) => work.published);
  const picks = recommendedWorks(db, publicWorks, Date.now(), 3).map((work) => work.id);
  assert.ok(picks.includes('w_inkcity'));
  assert.ok(picks.includes('w_lantern'));
});

test('最新排序依更新時間遞減', () => {
  const db = createSeedDatabase();
  const list = newestWorks(db.works.filter((work) => work.published));
  for (let i = 1; i < list.length; i += 1) {
    const previous = list[i - 1];
    const current = list[i];
    assert.ok(previous !== undefined && current !== undefined);
    assert.ok(Date.parse(previous.updatedAt) >= Date.parse(current.updatedAt));
  }
});
