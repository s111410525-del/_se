import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../src/core/errors.js';
import { createSeedDatabase } from '../../src/db/seed.js';
import {
  availableBalance,
  processWithdrawal,
  requestWithdrawal,
  reservedForWithdrawal,
  rewardRead,
  roundMoney,
  tipWork,
  totalEarned,
} from '../../src/services/earnings.js';
import { needChapter, needWork } from '../../src/services/works.js';
import { REVENUE_RULES } from '../../src/types.js';

function isStatus(status: number): (err: unknown) => boolean {
  return (err) => err instanceof HttpError && err.status === status;
}

test('種子資料的收益與可提領餘額符合預期', () => {
  const db = createSeedDatabase();
  assert.equal(totalEarned(db, 'u_quill'), 548.5);
  assert.equal(reservedForWithdrawal(db, 'u_quill'), 200);
  assert.equal(availableBalance(db, 'u_quill'), 348.5);
  assert.equal(totalEarned(db, 'u_aurora'), 411);
  assert.equal(availableBalance(db, 'u_aurora'), 111);
});

test('付費作品的閱讀會產生小額收益，作者自己閱讀與免費作品不計入', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_inkcity');
  const chapter = needChapter(db, work.id, 'ch_inkcity_1');
  const reader = db.users.find((user) => user.username === 'reader');
  assert.ok(reader !== undefined);
  const creator = db.users.find((user) => user.id === work.creatorId);
  assert.ok(creator !== undefined);

  const before = db.earnings.length;
  const reward = rewardRead(db, work, chapter.title, reader, new Date().toISOString());
  assert.equal(reward, REVENUE_RULES.viewReward);
  assert.equal(db.earnings.length, before + 1);

  assert.equal(rewardRead(db, work, chapter.title, creator, new Date().toISOString()), 0);

  const freeWork = needWork(db, 'w_catcomic');
  assert.equal(rewardRead(db, freeWork, '第 1 話', reader, new Date().toISOString()), 0);
});

test('打賞依 90% 分潤寫入收益，並擋下免費作品與自我打賞', () => {
  const db = createSeedDatabase();
  const work = needWork(db, 'w_inkcity');
  const reader = db.users.find((user) => user.username === 'reader');
  const creator = db.users.find((user) => user.id === work.creatorId);
  assert.ok(reader !== undefined);
  assert.ok(creator !== undefined);

  const tip = tipWork(db, work, reader, 100, '很喜歡', new Date().toISOString());
  assert.equal(tip.creatorShare, 90);
  assert.equal(tip.platformShare, 10);
  assert.equal(totalEarned(db, creator.id), 411 + 90);

  assert.throws(
    () => tipWork(db, needWork(db, 'w_catcomic'), reader, 100, '', new Date().toISOString()),
    isStatus(400),
  );
  assert.throws(
    () => tipWork(db, work, creator, 100, '', new Date().toISOString()),
    isStatus(400),
  );
  assert.throws(
    () => tipWork(db, work, reader, 5, '', new Date().toISOString()),
    isStatus(400),
  );
});

test('提領需要付費帳號、不得超過餘額，且一次只能有一筆審核中申請', () => {
  const db = createSeedDatabase();
  const quill = db.users.find((user) => user.username === 'quill');
  const inkcat = db.users.find((user) => user.username === 'inkcat');
  assert.ok(quill !== undefined);
  assert.ok(inkcat !== undefined);

  assert.throws(
    () => requestWithdrawal(db, inkcat, 100, '', new Date().toISOString()),
    isStatus(403),
  );
  assert.throws(
    () => requestWithdrawal(db, quill, 10, '', new Date().toISOString()),
    isStatus(400),
  );
  assert.throws(
    () => requestWithdrawal(db, quill, 1000, '', new Date().toISOString()),
    isStatus(400),
  );

  const withdrawal = requestWithdrawal(db, quill, 100, '測試', new Date().toISOString());
  assert.equal(withdrawal.status, 'pending');
  assert.equal(availableBalance(db, quill.id), 248.5);
  assert.throws(
    () => requestWithdrawal(db, quill, 100, '', new Date().toISOString()),
    isStatus(400),
  );

  processWithdrawal(db, withdrawal.id, 'rejected', '資料不足', new Date().toISOString());
  assert.equal(availableBalance(db, quill.id), 348.5);
});

test('金額四捨五入到分', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(90.006), 90.01);
});
