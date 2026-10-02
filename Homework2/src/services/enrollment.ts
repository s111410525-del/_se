import { conflict, forbidden, notFound } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Course, Database, Enrollment, Student, Term } from '../types.js';
import { isConflicting, needCourse } from './courses.js';
import { totalScoreOf } from './grades.js';

/** 某位學生在某學期的修課紀錄（含已退選）。 */
export function enrollmentsOf(db: Database, studentId: string, term: Term): Enrollment[] {
  const termCourseIds = new Set(db.courses.filter((course) => course.term === term).map((course) => course.id));
  return db.enrollments
    .filter((row) => row.studentId === studentId && termCourseIds.has(row.courseId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 只取出有效的（已選或候補）紀錄。 */
export function activeEnrollmentsOf(db: Database, studentId: string, term: Term): Enrollment[] {
  return enrollmentsOf(db, studentId, term).filter((row) => row.status !== 'dropped');
}

/** 找出某位學生在某門課的有效修課紀錄。 */
export function findEnrollment(db: Database, studentId: string, courseId: string): Enrollment | undefined {
  return db.enrollments.find(
    (row) => row.studentId === studentId && row.courseId === courseId && row.status !== 'dropped',
  );
}

/** 學生已修（取得及格成績）的課程代號集合。 */
export function passedCodes(db: Database, studentId: string): Set<string> {
  const passed = new Set<string>();
  for (const record of db.scores) {
    if (record.studentId !== studentId) continue;
    const course = db.courses.find((item) => item.id === record.courseId);
    if (course === undefined) continue;
    if (totalScoreOf(record) >= 60) passed.add(course.code.toUpperCase());
  }
  return passed;
}

/** 已登錄成績的學分總數（含不及格）。 */
export function earnedCredits(db: Database, studentId: string): number {
  let credits = 0;
  for (const record of db.scores) {
    if (record.studentId !== studentId) continue;
    const course = db.courses.find((item) => item.id === record.courseId);
    if (course !== undefined) credits += course.credits;
  }
  return credits;
}

/** 本學期已登記的學分數（正取 + 候補）。 */
export function registeredCredits(db: Database, studentId: string, term: Term): number {
  const courseIds = new Set(activeEnrollmentsOf(db, studentId, term).map((row) => row.courseId));
  return db.courses
    .filter((course) => courseIds.has(course.id))
    .reduce((sum, course) => sum + course.credits, 0);
}

/** 找出與目標課程衝堂的已選課程。 */
export function conflictingCourses(db: Database, student: Student, target: Course): Course[] {
  const ids = new Set(activeEnrollmentsOf(db, student.id, target.term).map((row) => row.courseId));
  return db.courses.filter((course) => ids.has(course.id) && isConflicting(course, target));
}

/** 檢查先修條件，回傳尚未及格的先修課程代號。 */
export function missingPrerequisites(db: Database, student: Student, target: Course): string[] {
  if (target.prerequisites.length === 0) return [];
  const passed = passedCodes(db, student.id);
  return target.prerequisites.filter((code) => !passed.has(code.toUpperCase()));
}

/** 指定課程的正取人數。 */
export function enrolledCountOf(db: Database, courseId: string): number {
  return db.enrollments.filter((row) => row.courseId === courseId && row.status === 'enrolled').length;
}

/** 指定課程的候補人數。 */
export function waitlistCountOf(db: Database, courseId: string): number {
  return db.enrollments.filter((row) => row.courseId === courseId && row.status === 'waitlisted').length;
}

export interface EnrollOptions {
  /** 學期學分上限。 */
  creditLimit: number;
  /** 目前開放選課的學期。 */
  currentTerm: Term;
}

export interface EnrollResult {
  enrollment: Enrollment;
  course: Course;
  /** 是否因名額已滿而進入候補。 */
  waitlisted: boolean;
}

/**
 * 選課。
 *
 * 依序檢查：學期 → 課程是否開放 → 重複選課 → 先修條件 → 衝堂 → 學分上限 →
 * 名額是否已滿。任何一項不通過都會拋出帶有說明的 `HttpError`，
 * 讓 HTTP 層直接轉成 4xx 回應，規則不需要散落在各個 handler 中。
 */
export function enroll(
  db: Database,
  student: Student,
  courseId: string,
  options: EnrollOptions,
  now: Date = new Date(),
): EnrollResult {
  const course = needCourse(db, courseId);

  if (course.term !== options.currentTerm) {
    throw conflict(`《${course.name}》不屬於本學期（${course.term}）的開課課程`);
  }
  if (!course.open) throw conflict(`《${course.name}》的選課已截止`);

  const existing = findEnrollment(db, student.id, course.id);
  if (existing !== undefined) {
    throw conflict(
      existing.status === 'waitlisted'
        ? `你已在《${course.name}》的候補名單中（候補順位 ${existing.queue}）`
        : `你已經選過《${course.name}》了`,
    );
  }

  const missing = missingPrerequisites(db, student, course);
  if (missing.length > 0) {
    throw conflict(`未滿足先修條件：《${course.name}》需要先修 ${missing.join('、')}`);
  }

  const clashes = conflictingCourses(db, student, course);
  if (clashes.length > 0) {
    const names = clashes.map((item) => `${item.code} ${item.name}`).join('、');
    throw conflict(`《${course.name}》與已選課程衝堂：${names}`);
  }

  const taken = registeredCredits(db, student.id, options.currentTerm);
  if (taken + course.credits > options.creditLimit) {
    throw conflict(
      `超出學分上限：本學期已選 ${taken} 學分，加上《${course.name}》的 ${course.credits} 學分將超過 ${options.creditLimit} 學分上限`,
    );
  }

  const waitlisted = enrolledCountOf(db, course.id) >= course.capacity;
  const nowIso = now.toISOString();
  const queue = waitlisted ? waitlistCountOf(db, course.id) + 1 : 0;

  const enrollment: Enrollment = {
    id: newId('enr'),
    studentId: student.id,
    courseId: course.id,
    status: waitlisted ? 'waitlisted' : 'enrolled',
    queue,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  db.enrollments.push(enrollment);
  return { enrollment, course, waitlisted };
}

export interface DropResult {
  course: Course;
  /** 被遞補為正取的候補紀錄（如果有的話）。 */
  promoted: Enrollment | undefined;
}

/**
 * 退選。
 *
 * 退選「正取」時，會依候補順位把第一位候補者遞補為正取——這是選課系統
 * 最容易被忽略、但最重要的連鎖反應。
 */
export function drop(
  db: Database,
  student: Student,
  courseId: string,
  now: Date = new Date(),
): DropResult {
  const course = needCourse(db, courseId);
  const row = db.enrollments.find(
    (item) => item.studentId === student.id && item.courseId === courseId && item.status !== 'dropped',
  );
  if (row === undefined) throw notFound(`你沒有選過《${course.name}》`);

  const wasEnrolled = row.status === 'enrolled';
  row.status = 'dropped';
  row.queue = 0;
  row.updatedAt = now.toISOString();

  let promoted: Enrollment | undefined;
  if (wasEnrolled) {
    promoted = db.enrollments
      .filter((item) => item.courseId === courseId && item.status === 'waitlisted')
      .sort((a, b) => a.queue - b.queue || a.createdAt.localeCompare(b.createdAt))[0];
    if (promoted !== undefined) {
      promoted.status = 'enrolled';
      promoted.queue = 0;
      promoted.updatedAt = now.toISOString();
    }
  }

  return { course, promoted };
}

/** 教師查看自己班級的選課名單。 */
export interface RosterRow {
  enrollment: Enrollment;
  student: Student;
}

/**
 * 取得某門課的名單。
 *
 * 授課教師只能看自己開的課；教職員（admin）可視需要查閱任何班級，
 * 其他身分拋出 403。
 */
export function rosterOf(
  db: Database,
  viewer: { id: string; role: string },
  courseId: string,
): { course: Course; rows: RosterRow[] } {
  const course = needCourse(db, courseId);
  if (viewer.role !== 'admin' && course.teacherId !== viewer.id) {
    throw forbidden('這門課不是您開的課程');
  }
  const rows = db.enrollments
    .filter((row) => row.courseId === courseId && row.status !== 'dropped')
    .map((enrollment) => {
      const student = db.users.find((user) => user.id === enrollment.studentId);
      if (student === undefined || student.role !== 'student') return undefined;
      return { enrollment, student };
    })
    .filter((row): row is RosterRow => row !== undefined)
    .sort(
      (a, b) =>
        a.enrollment.status.localeCompare(b.enrollment.status) ||
        a.enrollment.queue - b.enrollment.queue ||
        a.student.studentId.localeCompare(b.student.studentId),
    );
  return { course, rows };
}

/** 學生某學期已選的正取課程。 */
export function enrolledCourses(db: Database, studentId: string, term: Term): Course[] {
  const ids = new Set(
    db.enrollments
      .filter((row) => row.studentId === studentId && row.status === 'enrolled')
      .map((row) => row.courseId),
  );
  return db.courses.filter((course) => course.term === term && ids.has(course.id));
}

/** 某學期各課程的正取人數（用於熱門課程統計）。 */
export function enrollmentRanking(db: Database, term: Term): { course: Course; count: number }[] {
  return db.courses
    .filter((course) => course.term === term)
    .map((course) => ({ course, count: enrolledCountOf(db, course.id) }))
    .sort((a, b) => b.count - a.count);
}

/** 某學期整體的修課統計。 */
export interface TermStats {
  total: number;
  waitlisted: number;
  credits: number;
}

export function termStats(db: Database, term: Term): TermStats {
  const rows = db.enrollments.filter(
    (row) => row.status !== 'dropped' && db.courses.some((course) => course.id === row.courseId && course.term === term),
  );
  let credits = 0;
  for (const row of rows) {
    const course = db.courses.find((item) => item.id === row.courseId);
    if (course !== undefined && row.status === 'enrolled') credits += course.credits;
  }
  return {
    total: rows.filter((row) => row.status === 'enrolled').length,
    waitlisted: rows.filter((row) => row.status === 'waitlisted').length,
    credits,
  };
}