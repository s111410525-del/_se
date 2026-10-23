import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { emptyTimetable, termLabel, timetableOf, todayCourses } from '../../src/services/schedule.js';
import { freshDb } from './helpers.js';

describe('課表', () => {
  test('空白課表包含 5 天 x 12 節', () => {
    const cells = emptyTimetable();
    assert.equal(cells.length, 60);
    assert.equal(cells.every((cell) => cell.course === null), true);
  });

  test('已選課程會填入正確的節次', () => {
    const db = freshDb();
    const { cells, conflicts } = timetableOf(db, 'u_s001', '115-1');
    const find = (day: number, period: number) => cells.find((cell) => cell.day === day && cell.period === period);
    assert.equal(find(1, 3)?.course?.code, 'CS101');
    assert.equal(find(1, 4)?.course?.code, 'CS101');
    assert.equal(find(1, 5)?.course?.code, 'CS210');
    assert.equal(find(2, 3)?.course?.code, 'CS201');
    assert.equal(find(1, 7)?.course?.code, 'GE101');
    assert.equal(conflicts.length, 0);
  });

  test('衝堂課程會被標記，且先填入者保留', () => {
    const db = freshDb();
    const row = db.enrollments.find(
      (item) => item.studentId === 'u_s001' && item.courseId === 'c_cs330',
    );
    assert.ok(row !== undefined);
    row.status = 'enrolled';
    row.queue = 0;
    db.enrollments.push({
      id: 'e_test',
      studentId: 'u_s001',
      courseId: 'c_cs305',
      status: 'enrolled',
      queue: 0,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    });

    const { conflicts } = timetableOf(db, 'u_s001', '115-1');
    assert.deepEqual(conflicts.map((course) => course.code), ['CS330']);
  });

  test('todayCourses 依傳入日期取得當天課程', () => {
    const db = freshDb();
    const monday = new Date(2026, 9, 5, 10, 0, 0);
    const codes = todayCourses(db, 'u_s001', '115-1', monday).map((course) => course.code).sort();
    assert.deepEqual(codes, ['CS101', 'CS210', 'GE101']);
  });

  test('週末沒有課程', () => {
    const db = freshDb();
    const saturday = new Date(2026, 9, 10, 10, 0, 0);
    assert.equal(saturday.getDay(), 6);
    assert.deepEqual(todayCourses(db, 'u_s001', '115-1', saturday), []);
  });

  test('termLabel 轉換學期顯示文字', () => {
    assert.equal(termLabel('115-1'), '115 學年度上學期');
    assert.equal(termLabel('114-2'), '114 學年度下學期');
    assert.equal(termLabel('custom'), 'custom');
  });
});
