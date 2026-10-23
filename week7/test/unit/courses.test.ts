import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  describeSessions,
  findByCode,
  findCourse,
  isConflicting,
  listCourses,
  needCourse,
  seatsLeft,
  sessionGrid,
  slotsOf,
  statsOf,
} from '../../src/services/courses.js';
import { courseOf, freshDb } from './helpers.js';

describe('課程節次', () => {
  test('兩節課會展開成兩個連續格位', () => {
    const db = freshDb();
    const course = courseOf(db, 'c_cs101');
    assert.deepEqual(slotsOf(course), [
      { day: 1, period: 3 },
      { day: 1, period: 4 },
      { day: 3, period: 3 },
      { day: 3, period: 4 },
    ]);
  });

  test('單節課只佔一個格位', () => {
    const db = freshDb();
    const course = courseOf(db, 'c_cs201');
    assert.deepEqual(slotsOf(course), [
      { day: 2, period: 3 },
      { day: 4, period: 3 },
    ]);
  });

  test('同一門課不會與自己衝突', () => {
    const db = freshDb();
    const course = courseOf(db, 'c_cs101');
    assert.equal(isConflicting(course, course), false);
  });

  test('時段重疊的課程會判定為衝堂', () => {
    const db = freshDb();
    assert.equal(isConflicting(courseOf(db, 'c_cs305'), courseOf(db, 'c_cs330')), true);
  });

  test('時段不重疊的課程不會衝堂', () => {
    const db = freshDb();
    assert.equal(isConflicting(courseOf(db, 'c_cs101'), courseOf(db, 'c_cs201')), false);
  });

  test('describeSessions 產生可讀的週次與節次', () => {
    const db = freshDb();
    assert.equal(
      describeSessions(courseOf(db, 'c_cs101')),
      '週一 第 3-4 節、週三 第 3-4 節',
    );
  });

  test('sessionGrid 產生 5 天 x 12 節', () => {
    const grid = sessionGrid();
    assert.equal(grid.length, 60);
    assert.deepEqual(grid[0], { day: 1, period: 1 });
    assert.deepEqual(grid.at(-1), { day: 5, period: 12 });
  });
});

describe('課程查詢', () => {
  test('findByCode 不分大小寫並忽略空白', () => {
    const db = freshDb();
    assert.equal(findByCode(db, ' cs101 ')?.id, 'c_cs101');
    assert.equal(findByCode(db, 'NOPE'), undefined);
  });

  test('findCourse 找不到時回傳 undefined，needCourse 則拋出 404', () => {
    const db = freshDb();
    assert.equal(findCourse(db, 'nope'), undefined);
    assert.throws(() => needCourse(db, 'nope'), (err: unknown) => {
      return err instanceof Error && 'status' in err && err.status === 404;
    });
  });

  test('依學期與關鍵字篩選', () => {
    const db = freshDb();
    assert.equal(listCourses(db, { term: '115-1' }).length, 9);
    assert.equal(listCourses(db, { term: '114-2' }).length, 3);

    const result = listCourses(db, { term: '115-1', keyword: '資料' });
    assert.deepEqual(result.map((course) => course.code), ['CS210']);
  });

  test('依教師與類別篩選', () => {
    const db = freshDb();
    assert.equal(listCourses(db, { teacherId: 'u_tchen', term: '115-1' }).length, 3);
    assert.deepEqual(
      listCourses(db, { category: '必修', term: '115-1' }).map((course) => course.code).sort(),
      ['CS101', 'CS210'],
    );
  });

  test('onlyOpen 會排除已額滿的課程', () => {
    const db = freshDb();
    const open = listCourses(db, { term: '115-1', onlyOpen: true });
    assert.equal(open.some((course) => course.code === 'CS330'), false);
  });

  test('seatsLeft 不會小於 0，並可取得統計', () => {
    const db = freshDb();
    const full = courseOf(db, 'c_cs330');
    assert.equal(seatsLeft(db, full), 0);

    const stats = statsOf(db, full);
    assert.equal(stats.enrolled, 4);
    assert.equal(stats.waitlisted, 1);
    assert.equal(stats.seatsLeft, 0);
    assert.equal(stats.teacherName, '林志豪');
  });
});
