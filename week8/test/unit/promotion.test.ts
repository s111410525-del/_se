import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import {
  activePromotion,
  ensurePlanPromotion,
  recordClick,
  startAdminPromotion,
} from '../../src/services/promotion.js';
import { needWork } from '../../src/services/works.js';

const NOW = '2026-10-30T00:00:00.000Z';

test('付費作品可以建立方案推流，免費作品不行', () => {
  const db = createSeedDatabase();
  const paidWork = needWork(db, 'w_stars');
  const freeWork = needWork(db, 'w_catcomic');

  const promotion = ensurePlanPromotion(db, paidWork, NOW);
  assert.ok(promotion !== undefined);
  assert.equal(promotion.source, 'plan');
  assert.equal(activePromotion(db, paidWork.id, Date.parse(NOW))?.id, promotion.id);

  assert.equal(ensurePlanPromotion(db, freeWork, NOW), undefined);
});

test('進行中的推流不會被重複建立', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_inkcity');
  const first = activePromotion(db, work.id, Date.now());
  const ensured = ensurePlanPromotion(db, work, new Date().toISOString());
  assert.ok(first !== undefined && ensured !== undefined);
  assert.equal(first.id, ensured.id);
});

test('管理員可以替免費作品開啟推流並累計點擊', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_catcomic');
  const promotion = startAdminPromotion(db, work, NOW);
  assert.equal(promotion.source, 'admin');
  assert.equal(Math.round((Date.parse(promotion.expiresAt) - Date.parse(promotion.startedAt)) / 86_400_000), 14);

  recordClick(db, work.id, Date.parse(NOW));
  assert.equal(promotion.clicks, 1);
});
