import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import { needUser } from '../../src/services/accounts.js';
import { createJob, type JobFormInput } from '../../src/services/jobs.js';
import { ledgerOf, needPlan, purchasePromotion, topUp } from '../../src/services/wallet.js';

const NOW = '2026-01-01T00:00:00.000Z';

function jobInput(title: string): JobFormInput {
  return {
    title,
    category: 'tech',
    employmentType: 'full-time',
    location: '台北市',
    description: '測試用職缺內容。',
    requirements: '測試用工作要求。',
    benefits: '勞健保',
    tags: ['TypeScript'],
    salaryMin: 50000,
    salaryMax: 80000,
    salaryNote: '',
    published: true,
  };
}

test('儲值會增加餘額並留下流水', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const before = dean.balance;

  const topup = topUp(db, dean, 300, '信用卡（模擬）', NOW);

  assert.equal(topup.amount, 300);
  assert.equal(dean.balance, before + 300);
  const ledger = ledgerOf(db, dean.id);
  const entry = ledger.find(
    (item) => item.kind === 'topup' && item.amount === 300 && item.balanceAfter === dean.balance,
  );
  assert.ok(entry !== undefined);
});

test('購買曝光會扣款、建立曝光並記錄流水', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const job = createJob(db, dean, jobInput('測試前端工程師'), NOW);
  const before = dean.balance;

  const plan = needPlan(7);
  const promotion = purchasePromotion(db, dean, job, plan, NOW);

  assert.equal(promotion.source, 'wallet');
  assert.equal(promotion.amount, plan.price);
  assert.equal(dean.balance, before - plan.price);
  assert.equal(
    Math.round((Date.parse(promotion.expiresAt) - Date.parse(promotion.startedAt)) / 86_400_000),
    7,
  );
  const entry = ledgerOf(db, dean.id).find(
    (item) => item.kind === 'promotion' && item.amount === -plan.price && item.balanceAfter === dean.balance,
  );
  assert.ok(entry !== undefined);
  assert.match(entry.note, new RegExp(job.title));
});

test('餘額不足與非職缺擁有者都無法購買曝光', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const mira = needUser(db, 'u_mira');
  const nova = needUser(db, 'u_nova');
  const job = createJob(db, dean, jobInput('測試後端工程師'), NOW);
  const plan = needPlan(7);

  assert.throws(() => purchasePromotion(db, mira, job, plan, NOW), /只能替自己的職缺/);

  nova.balance = 0;
  assert.throws(() => purchasePromotion(db, nova, job, plan, NOW), /只能替自己的職缺/);

  const novaJob = createJob(db, nova, jobInput('測試資料工程師'), NOW);
  assert.throws(() => purchasePromotion(db, nova, novaJob, plan, NOW), /餘額不足/);
});

test('儲值金額必須落在平台規則內', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');

  assert.throws(() => topUp(db, dean, 99, '信用卡（模擬）', NOW), /100 到 10000/);
  assert.throws(() => topUp(db, dean, 10001, '信用卡（模擬）', NOW), /100 到 10000/);
});
