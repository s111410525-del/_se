import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classGrades,
  cumulativeGpa,
  gpaOf,
  gradePointOf,
  letterOf,
  normalizeItems,
  publishedTranscript,
  scoreRecordOf,
  setPublished,
  setScore,
  totalScoreOf,
  transcript,
} from '../../src/services/grades.js';
import { freshDb, studentOf } from './helpers.js';

function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && 'status' in err && err.status === status;
}

describe('成績計算', () => {
  test('依權重計算加權總分', () => {
    assert.equal(totalScoreOf({ items: [
      { name: '期中考', score: 80, weight: 50 },
      { name: '期末考', score: 90, weight: 50 },
    ] }), 85);
  });

  test('權重總和不必等於 100', () => {
    assert.equal(totalScoreOf({ items: [
      { name: '作業', score: 70, weight: 2 },
      { name: '考試', score: 90, weight: 1 },
    ] }), 76.7);
  });

  test('分數會限制在 0 到 100 之間', () => {
    assert.equal(totalScoreOf({ items: [{ name: 'a', score: 120, weight: 1 }] }), 100);
    assert.equal(totalScoreOf({ items: [{ name: 'a', score: -20, weight: 1 }] }), 0);
  });

  test('權重 0 的項目會被忽略', () => {
    assert.equal(totalScoreOf({ items: [
      { name: '未計分', score: 100, weight: 0 },
      { name: '計分', score: 50, weight: 10 },
    ] }), 50);
  });

  test('沒有有效權重時回傳 0', () => {
    assert.equal(totalScoreOf({ items: [] }), 0);
  });
});

describe('等第與績分', () => {
  test('letterOf 的邊界正確', () => {
    assert.equal(letterOf(100), 'A');
    assert.equal(letterOf(90), 'A');
    assert.equal(letterOf(89.9), 'B');
    assert.equal(letterOf(80), 'B');
    assert.equal(letterOf(79.9), 'C');
    assert.equal(letterOf(70), 'C');
    assert.equal(letterOf(69.9), 'D');
    assert.equal(letterOf(60), 'D');
    assert.equal(letterOf(59.9), 'F');
    assert.equal(letterOf(0), 'F');
  });

  test('gradePointOf 對應五級制，未知等第為 0', () => {
    assert.equal(gradePointOf('A'), 4);
    assert.equal(gradePointOf('B'), 3);
    assert.equal(gradePointOf('C'), 2);
    assert.equal(gradePointOf('D'), 1);
    assert.equal(gradePointOf('F'), 0);
    assert.equal(gradePointOf('X'), 0);
  });
});

describe('GPA 與成績單', () => {
  test('gpaOf 只計算指定學期已公布的成績', () => {
    const db = freshDb();
    const summary = gpaOf(db, 'u_s001', '114-2');
    assert.equal(summary.credits, 6);
    assert.equal(summary.gpa, 3);
  });

  test('本學期未公布成績不列入 GPA', () => {
    const db = freshDb();
    assert.deepEqual(gpaOf(db, 'u_s001', '115-1'), { credits: 0, gpa: 0 });
  });

  test('cumulativeGpa 加總所有已公布成績', () => {
    const db = freshDb();
    assert.deepEqual(cumulativeGpa(db, 'u_s001'), { credits: 6, gpa: 3 });
  });

  test('transcript 依學期與課程代號排序', () => {
    const db = freshDb();
    const rows = transcript(db, 'u_s001');
    assert.deepEqual(rows.map((row) => `${row.course.term}/${row.course.code}`), [
      '114-2/CS100',
      '114-2/MA101',
      '115-1/CS101',
    ]);
  });

  test('publishedTranscript 排除未公布成績', () => {
    const db = freshDb();
    const rows = publishedTranscript(db, 'u_s001', '114-2');
    assert.equal(rows.length, 2);
    assert.equal(publishedTranscript(db, 'u_s001', '115-1').length, 0);
  });

  test('scoreRecordOf 可以找到既有的成績紀錄', () => {
    const db = freshDb();
    assert.equal(scoreRecordOf(db, 'u_s001', 'c_cs100')?.published, true);
    assert.equal(scoreRecordOf(db, 'u_s001', 'c_cs399'), undefined);
  });
});

describe('成績驗證', () => {
  test('至少需要一個評分項目', () => {
    assert.throws(() => normalizeItems([]), (err: unknown) => isStatus(err, 400));
  });

  test('評分名稱不得重複', () => {
    assert.throws(
      () => normalizeItems([
        { name: '期中考', score: 80, weight: 50 },
        { name: '期中考', score: 90, weight: 50 },
      ]),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /重複/u.test(err.message),
    );
  });

  test('分數必須介於 0 與 100', () => {
    assert.throws(
      () => normalizeItems([{ name: '期中', score: 101, weight: 50 }]),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /分數/u.test(err.message),
    );
  });

  test('權重必須大於 0', () => {
    assert.throws(
      () => normalizeItems([{ name: '期中', score: 80, weight: 0 }]),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /權重/u.test(err.message),
    );
  });

  test('名稱會去除空白、分數會四捨五入到小數一位', () => {
    assert.deepEqual(normalizeItems([{ name: '  期中  ', score: 80.56, weight: 50 }]), [
      { name: '期中', score: 80.6, weight: 50 },
    ]);
  });
});

describe('成績寫入權限', () => {
  test('授課教師可以為自己的學生輸入成績', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s003');
    const record = setScore(
      db,
      { id: 'u_tchen', role: 'teacher' },
      student,
      'c_cs101',
      [{ name: '期末考', score: 88, weight: 100 }],
      new Date('2026-10-05T01:00:00.000Z'),
    );
    assert.equal(record.published, false);
    assert.equal(record.updatedAt, '2026-10-05T01:00:00.000Z');
    assert.equal(scoreRecordOf(db, 'u_s003', 'c_cs101')?.items[0]?.score, 88);
  });

  test('教師不能為其他教師的課程輸入成績', () => {
    const db = freshDb();
    assert.throws(
      () => setScore(db, { id: 'u_tlin', role: 'teacher' }, studentOf(db, 'u_s001'), 'c_cs101', [
        { name: '期末考', score: 88, weight: 100 },
      ]),
      (err: unknown) => isStatus(err, 403),
    );
  });

  test('學生未選修課程時不能輸入成績', () => {
    const db = freshDb();
    assert.throws(
      () => setScore(db, { id: 'u_tchen', role: 'teacher' }, studentOf(db, 'u_s002'), 'c_cs399', [
        { name: '期末考', score: 88, weight: 100 },
      ]),
      (err: unknown) => isStatus(err, 400) && err instanceof Error && /未選修/u.test(err.message),
    );
  });

  test('管理員可以為任何課程輸入成績', () => {
    const db = freshDb();
    const record = setScore(db, { id: 'u_admin', role: 'admin' }, studentOf(db, 'u_s001'), 'c_cs101', [
      { name: '期末考', score: 77, weight: 100 },
    ]);
    assert.equal(record.items[0]?.score, 77);
  });

  test('公布與取消公布成績', () => {
    const db = freshDb();
    const record = db.scores.find((row) => row.id === 's_021');
    assert.ok(record !== undefined);
    assert.equal(record.published, false);

    setPublished(db, { id: 'u_tchen', role: 'teacher' }, 's_021', true);
    assert.equal(record.published, true);
    setPublished(db, { id: 'u_admin', role: 'admin' }, 's_021', false);
    assert.equal(record.published, false);
  });

  test('教師不能公布其他教師課程的成績', () => {
    const db = freshDb();
    assert.throws(
      () => setPublished(db, { id: 'u_tlin', role: 'teacher' }, 's_021', true),
      (err: unknown) => isStatus(err, 403),
    );
  });

  test('找不到成績紀錄時回傳 404', () => {
    const db = freshDb();
    assert.throws(
      () => setPublished(db, { id: 'u_admin', role: 'admin' }, 'missing', true),
      (err: unknown) => isStatus(err, 404),
    );
  });

  test('classGrades 依學號排序並標示未輸入成績', () => {
    const db = freshDb();
    const rows = classGrades(db, 'c_cs101');
    assert.deepEqual(rows.map((row) => row.student.studentId), [
      '41115001',
      '41115002',
      '41115003',
      '41115004',
      '41115005',
    ]);
    assert.equal(rows[0]?.record?.published, false);
  });
});
