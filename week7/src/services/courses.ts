import { notFound } from '../core/errors.js';
import type { Course, Database, EnrollmentStatus, Session, Term } from '../types.js';
import { DAYS, PERIODS } from '../types.js';
import { teacherName } from './accounts.js';

export interface CourseFilters {
  term?: Term;
  keyword?: string;
  teacherId?: string;
  category?: string;
  /** 只顯示尚有名額的課程。 */
  onlyOpen?: boolean;
}

/** 課程在某一節課所占用的格位（考慮 1 節或 2 節課）。 */
export interface Slot {
  day: number;
  period: number;
}

/** 把課程的每個上課時段展開成單節格位。 */
export function slotsOf(course: Course): Slot[] {
  const slots: Slot[] = [];
  for (const session of course.sessions) {
    const start = course.periods === 2 ? session.start + 1 : session.start;
    for (let period = session.start; period <= start; period += 1) {
      slots.push({ day: session.day, period });
    }
  }
  return slots;
}

/** 兩門課是否有重疊的節次。 */
export function isConflicting(a: Course, b: Course): boolean {
  if (a.id === b.id) return false;
  const taken = new Set(slotsOf(a).map((slot) => `${slot.day}-${slot.period}`));
  return slotsOf(b).some((slot) => taken.has(`${slot.day}-${slot.period}`));
}

/** 以 id 查課程。 */
export function findCourse(db: Database, id: string): Course | undefined {
  return db.courses.find((course) => course.id === id);
}

/** 以 id 查課程，找不到時拋出 404。 */
export function needCourse(db: Database, id: string): Course {
  const course = findCourse(db, id);
  if (course === undefined) throw notFound(`找不到課程 ${id}`);
  return course;
}

/** 依代號查課程。 */
export function findByCode(db: Database, code: string): Course | undefined {
  const key = code.trim().toUpperCase();
  return db.courses.find((course) => course.code.toUpperCase() === key);
}

/** 依條件篩選課程；條件全空時回傳全部課程。 */
export function listCourses(db: Database, filters: CourseFilters = {}): Course[] {
  const keyword = (filters.keyword ?? '').trim().toLowerCase();
  return db.courses.filter((course) => {
    if (filters.term !== undefined && filters.term !== '' && course.term !== filters.term) return false;
    if (filters.teacherId !== undefined && filters.teacherId !== '' && course.teacherId !== filters.teacherId) return false;
    if (filters.category !== undefined && filters.category !== '' && course.category !== filters.category) return false;
    if (filters.onlyOpen === true && seatsLeft(db, course) <= 0) return false;
    if (keyword !== '') {
      const haystack = `${course.code} ${course.name} ${course.englishName} ${teacherName(db, course.teacherId)}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

/** 指定狀態的修課名單筆數。 */
export function countEnrolled(db: Database, courseId: string, status: EnrollmentStatus): number {
  return db.enrollments.filter((row) => row.courseId === courseId && row.status === status).length;
}

/** 正取人數。 */
export function enrolledCount(db: Database, courseId: string): number {
  return countEnrolled(db, courseId, 'enrolled');
}

/** 候補人數。 */
export function waitlistCount(db: Database, courseId: string): number {
  return countEnrolled(db, courseId, 'waitlisted');
}

/** 剩餘正取名額（不會小於 0）。 */
export function seatsLeft(db: Database, course: Course): number {
  return Math.max(0, course.capacity - enrolledCount(db, course.id));
}

/** 課程狀態摘要。 */
export interface CourseStats {
  enrolled: number;
  waitlisted: number;
  seatsLeft: number;
  capacity: number;
  teacherName: string;
}

/** 收集一門課目前的選課統計。 */
export function statsOf(db: Database, course: Course): CourseStats {
  return {
    enrolled: enrolledCount(db, course.id),
    waitlisted: waitlistCount(db, course.id),
    seatsLeft: seatsLeft(db, course),
    capacity: course.capacity,
    teacherName: teacherName(db, course.teacherId),
  };
}

/** 某位教師開的課。 */
export function coursesOfTeacher(db: Database, teacherId: string, term?: Term): Course[] {
  return listCourses(db, { teacherId, term });
}

/** 把上課時段轉為文字，例如「週一第 3-4 節」。 */
export function describeSessions(course: Course): string {
  return course.sessions
    .map((session: Session) => {
      const last = course.periods === 2 ? session.start + 1 : session.start;
      return `週${'一二三四五'[session.day - 1] ?? '?'} 第 ${session.start}-${last} 節`;
    })
    .join('、');
}

/** 產生固定順序的節次清單（禮拜一至五、第 1 節到第 12 節）。 */
export function sessionGrid(): Slot[] {
  const grid: Slot[] = [];
  for (const day of DAYS) {
    for (const period of PERIODS) grid.push({ day, period });
  }
  return grid;
}