import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import { needUser } from '../../src/services/accounts.js';
import { createJob, type JobFormInput } from '../../src/services/jobs.js';
import {
  applyToJob,
  markRead,
  messagesOf,
  sendMessage,
  setConversationStatus,
  unreadCount,
} from '../../src/services/messaging.js';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:01:00.000Z';
const T2 = '2026-01-01T00:02:00.000Z';
const T3 = '2026-01-01T00:03:00.000Z';

const INPUT: JobFormInput = {
  title: '測試前端工程師',
  category: 'tech',
  employmentType: 'full-time',
  location: '台北市',
  description: '負責開發產品介面。',
  requirements: '熟悉 TypeScript。',
  benefits: '勞健保',
  tags: ['TypeScript', 'React'],
  salaryMin: 60000,
  salaryMax: 90000,
  salaryNote: '',
  published: true,
};

test('應徵會建立對話與第一則訊息', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const lena = needUser(db, 'u_lena');
  const job = createJob(db, dean, INPUT, T0);

  const result = applyToJob(db, job, lena, '你好，我想應徵這個職位。', T0);

  assert.equal(result.created, true);
  assert.equal(result.conversation.status, 'applied');
  assert.equal(result.conversation.jobId, job.id);
  assert.equal(result.conversation.employerId, dean.id);
  assert.equal(messagesOf(db, result.conversation.id).length, 1);
  assert.equal(unreadCount(db, result.conversation, dean.id), 1);
  assert.equal(unreadCount(db, result.conversation, lena.id), 0);
});

test('讀取、回覆與未讀數會依雙方時間更新', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const lena = needUser(db, 'u_lena');
  const job = createJob(db, dean, INPUT, T0);
  const { conversation } = applyToJob(db, job, lena, '第一則訊息', T0);

  markRead(conversation, dean.id, T1);
  assert.equal(unreadCount(db, conversation, dean.id), 0);

  sendMessage(db, conversation, dean, '方便下週面談嗎？', T2);
  assert.equal(unreadCount(db, conversation, lena.id), 1);
  assert.equal(unreadCount(db, conversation, dean.id), 0);
  assert.equal(messagesOf(db, conversation.id).length, 2);

  setConversationStatus(conversation, 'invited', T2);
  assert.equal(conversation.status, 'invited');
  assert.equal(conversation.updatedAt, T2);
});

test('重複應徵會沿用同一個對話並可重新開啟已結束的應徵', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const lena = needUser(db, 'u_lena');
  const job = createJob(db, dean, INPUT, T0);
  const first = applyToJob(db, job, lena, '第一次應徵', T0);
  setConversationStatus(first.conversation, 'closed', T1);

  const second = applyToJob(db, job, lena, '再次應徵', T3);

  assert.equal(second.created, false);
  assert.equal(second.conversation.id, first.conversation.id);
  assert.equal(second.conversation.status, 'applied');
  assert.equal(messagesOf(db, second.conversation.id).length, 2);
});

test('只有求職者可以應徵，且不能應徵未公開職缺', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const lena = needUser(db, 'u_lena');
  const job = createJob(db, dean, INPUT, T0);

  assert.throws(() => applyToJob(db, job, dean, '想應徵', T0), /只有求職者/);

  job.published = false;
  assert.throws(() => applyToJob(db, job, lena, '想應徵', T0), /沒有開放應徵/);
});
