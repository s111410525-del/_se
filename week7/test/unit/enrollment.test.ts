import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  activeEnrollmentsOf,
  drop,
  enrolledCountOf,
  enrolledCourses,
  enroll,
  findEnrollment,
  missingPrerequisites,
  passedCodes,
  registeredCredits,
  waitlistCountOf,
} from '../../src/services/enrollment.js';
import { courseOf, freshDb, studentOf } from './helpers.js';

const OPTIONS = { creditLimit: 25, currentTerm: '115-1' };
const NOW = new Date('2026-10-05T01:00:00.000Z');

function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && 'status' in err && err.status === status;
}

describe('選課規則', () => {
  test('可以加選有名額且不衝堂的課程', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    const result = enroll(db, student, 'c_cs399', OPTIONS, NOW);

    assert.equal(result.waitlisted, false);
    assert.equal(result.enrollment.status, 'enrolled');
    assert.equal(result.enrollment.queue, 0);
    assert.equal(result.enrollment.createdAt, NOW.toISOString());
    assert.equal(findEnrollment(db, student.id, 'c_cs399')?.status, 'enrolled');
  });

  test('重複選課會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => enroll(db, student, 'c_cs101', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /已經選過/u.test(err.message);
    });
  });

  test('已在候補名單中不可重複選課', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => enroll(db, student, 'c_cs330', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /候補名單/u.test(err.message);
    });
  });

  test('非本學期課程會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => enroll(db, student, 'c_cs100', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /不屬於本學期/u.test(err.message);
    });
  });

  test('關閉選課的課程會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    courseOf(db, 'c_cs399').open = false;
    assert.throws(() => enroll(db, student, 'c_cs399', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /選課已截止/u.test(err.message);
    });
  });

  test('未滿足先修條件會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.deepEqual(missingPrerequisites(db, student, courseOf(db, 'c_cs320')), ['CS305']);
    assert.throws(() => enroll(db, student, 'c_cs320', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /先修/u.test(err.message);
    });
  });

  test('已通過的先修課程不再阻擋', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.equal(passedCodes(db, student.id).has('CS100'), true);
    assert.deepEqual(missingPrerequisites(db, student, courseOf(db, 'c_cs201')), []);
  });

  test('與已選課程衝堂會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => enroll(db, student, 'c_cs305', OPTIONS, NOW), (err: unknown) => {
      return isStatus(err, 409) && err instanceof Error && /衝堂/u.test(err.message);
    });
  });

  test('超過學分上限會被擋下', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(
      () => enroll(db, student, 'c_cs399', { creditLimit: 1, currentTerm: '115-1' }, NOW),
      (err: unknown) => isStatus(err, 409) && err instanceof Error && /學分上限/u.test(err.message),
    );
  });

  test('名額已滿時自動進入候補並取得順位', () => {
    const db = freshDb();
    const student = structuredClone(studentOf(db, 'u_s001'));
    student.id = 'u_test';
    student.username = 'test';
    student.studentId = '49999999';
    db.users.push(student);
    db.scores.push({
      id: 's_test',
      studentId: student.id,
      courseId: 'c_cs100',
      items: [{ name: '總成績', score: 85, weight: 100 }],
      published: true,
      updatedAt: '2026-08-20T00:00:00.000Z',
    });

    const result = enroll(db, student, 'c_cs330', OPTIONS, NOW);
    assert.equal(result.waitlisted, true);
    assert.equal(result.enrollment.status, 'waitlisted');
    assert.equal(result.enrollment.queue, 2);
    assert.equal(waitlistCountOf(db, 'c_cs330'), 2);
  });

  test('找不到課程時回傳 404', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => enroll(db, student, 'missing', OPTIONS, NOW), (err: unknown) => isStatus(err, 404));
  });
});

describe('退選與候補遞補', () => {
  test('退選正取後，候補第一位自動遞補', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s002');
    const result = drop(db, student, 'c_cs330', NOW);

    assert.equal(result.promoted?.studentId, 'u_s001');
    assert.equal(result.promoted?.status, 'enrolled');
    assert.equal(result.promoted?.queue, 0);
    assert.equal(findEnrollment(db, 'u_s001', 'c_cs330')?.status, 'enrolled');
  });

  test('退選後原紀錄標記為 dropped', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s002');
    drop(db, student, 'c_cs330', NOW);
    const row = db.enrollments.find(
      (item) => item.studentId === 'u_s002' && item.courseId === 'c_cs330',
    );
    assert.equal(row?.status, 'dropped');
    assert.equal(row?.queue, 0);
    assert.equal(row?.updatedAt, NOW.toISOString());
  });

  test('退選候補課程不會觸發遞補', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    const result = drop(db, student, 'c_cs330', NOW);
    assert.equal(result.promoted, undefined);
    assert.equal(findEnrollment(db, 'u_s001', 'c_cs330'), undefined);
  });

  test('退選沒選過的課程會回傳 404', () => {
    const db = freshDb();
    const student = studentOf(db, 'u_s001');
    assert.throws(() => drop(db, student, 'c_cs305', NOW), (err: unknown) => isStatus(err, 404));
  });
});

describe('修課統計', () => {
  test('registeredCredits 包含正取與候補學分', () => {
    const db = freshDb();
    assert.equal(registeredCredits(db, 'u_s001', '115-1'), 14);
  });

  test('activeEnrollmentsOf 排除已退選紀錄', () => {
    const db = freshDb();
    const row = db.enrollments.find(
      (item) => item.studentId === 'u_s001' && item.courseId === 'c_cs101',
    );
    assert.ok(row !== undefined);
    row.status = 'dropped';
    const active = activeEnrollmentsOf(db, 'u_s001', '115-1');
    assert.equal(active.some((item) => item.courseId === 'c_cs101'), false);
  });

  test('enrolledCourses 只回傳正取課程', () => {
    const db = freshDb();
    const codes = enrolledCourses(db, 'u_s001', '115-1').map((course) => course.code).sort();
    assert.deepEqual(codes, ['CS101', 'CS201', 'CS210', 'GE101']);
  });

  test('課程人數統計正確', () => {
    const db = freshDb();
    assert.equal(enrolledCountOf(db, 'c_cs330'), 4);
    assert.equal(waitlistCountOf(db, 'c_cs330'), 1);
    assert.equal(enrolledCountOf(db, 'c_cs101'), 5);
  });
});
