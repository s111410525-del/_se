import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startHarness, type Harness } from './helpers.js';
import { cumulativeGpa, gpaOf } from '../src/services/grades.js';

describe('教師輸入成績', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('tchen');
  });

  after(async () => {
    await h.close();
  });

  test('成績簿列出修課學生', async () => {
    const res = await h.browser.get('/grades/course/c_cs101');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /陳秉硯/);
  });

  test('可以輸入成績並儲存', async () => {
    const res = await h.browser.post('/grades/course/c_cs101/student/u_s001', {
      name_0: '期中考',
      score_0: '80',
      weight_0: '50',
      name_1: '期末考',
      score_1: '90',
      weight_1: '50',
    });
    assert.equal(res.status, 303);

    const record = h.app.store.data.scores.find(
      (row) => row.studentId === 'u_s001' && row.courseId === 'c_cs101',
    );
    assert.equal(record?.items.length, 2);
    assert.equal(record?.published, false);
  });

  test('權重超過 100 時拒絕儲存', async () => {
    const res = await h.browser.post('/grades/course/c_cs101/student/u_s001', {
      name_0: '期中考',
      score_0: '80',
      weight_0: '150',
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /權重/);
  });

  test('分數超出 0 到 100 時拒絕儲存', async () => {
    const res = await h.browser.post('/grades/course/c_cs101/student/u_s001', {
      name_0: '期中考',
      score_0: '120',
      weight_0: '100',
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /分數/);
  });

  test('不能為未選修的學生輸入成績', async () => {
    // CS399 只有 s001 選修。
    const res = await h.browser.post('/grades/course/c_cs399/student/u_s002');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /未選修/);
  });
});

describe('成績公布與 GPA', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
    await h.browser.login('tchen');
  });

  after(async () => {
    await h.close();
  });

  test('未公布的成績不會出現在學生的 GPA', () => {
    const db = h.app.store.data;
    const student = h.app.store.data.users.find((user) => user.id === 'u_s001');
    assert.ok(student !== undefined);

    const unpublished = db.scores.filter(
      (row) => row.studentId === 'u_s001' && row.courseId !== 'c_cs100' && row.courseId !== 'c_ma101' && !row.published,
    );
    assert.ok(unpublished.length > 0, '種子資料應有尚未公布的成績');

    // 只計已公布成績（114-2 的 CS100、MA101 共 6 學分）。
    const summary = cumulativeGpa(db, student.id);
    assert.equal(summary.credits, 6);
    assert.ok(summary.gpa > 0);
  });

  test('公布成績後 GPA 立即更新', async () => {
    const record = h.app.store.data.scores.find(
      (row) => row.studentId === 'u_s001' && row.courseId === 'c_cs101',
    );
    assert.ok(record !== undefined);

    const res = await h.browser.post(`/grades/${record.id}/publish`, {
      courseId: 'c_cs101',
      published: '1',
    });
    assert.equal(res.status, 303);
    assert.equal(h.app.store.data.scores.find((row) => row.id === record.id)?.published, true);

    const after = cumulativeGpa(h.app.store.data, 'u_s001');
    assert.ok(after.credits > 6);
    const term = gpaOf(h.app.store.data, 'u_s001', '115-1');
    assert.ok(term.credits >= 3);
  });

  test('學生看不到未公布的成績', async () => {
    const student = await startHarness();
    try {
      await student.browser.login('s001');
      const res = await student.browser.get('/grades');
      assert.equal(res.status, 200);
      const html = await res.text();
      // CS101 已公布，CS201 尚未公布。
      assert.match(html, /CS101/);
      assert.doesNotMatch(html, /CS201/);
    } finally {
      await student.close();
    }
  });
});
