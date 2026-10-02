import type { Course, Database, Term } from '../types.js';
import { DAYS, PERIODS } from '../types.js';
import { enrolledCourses } from './enrollment.js';
import { slotsOf, type Slot } from './courses.js';

/** 課表格子。 */
export interface TimetableCell extends Slot {
  course: Course | null;
}

/** 產生固定尺寸的空白課表。 */
export function emptyTimetable(): TimetableCell[] {
  const cells: TimetableCell[] = [];
  for (const day of DAYS) {
    for (const period of PERIODS) cells.push({ day, period, course: null });
  }
  return cells;
}

/**
 * 依已選課程排出課表。
 *
 * 先把每門課展開成單節格位再填入表格，因此 2 節課會自然佔用兩列；
 * 若兩門課真的撞到同一格，先填入者保留，後填入者會被標記衝突。
 */
export function timetableOf(db: Database, studentId: string, term: Term): { cells: TimetableCell[]; conflicts: Course[] } {
  const cells = emptyTimetable();
  const index = new Map<string, TimetableCell>();
  for (const cell of cells) index.set(`${cell.day}-${cell.period}`, cell);

  const conflicts: Course[] = [];
  const claimed = new Map<string, Course>();

  for (const course of enrolledCourses(db, studentId, term)) {
    let collided = false;
    for (const slot of slotsOf(course)) {
      const key = `${slot.day}-${slot.period}`;
      const owner = claimed.get(key);
      if (owner !== undefined) {
        collided = true;
        continue;
      }
      claimed.set(key, course);
      const cell = index.get(key);
      if (cell !== undefined) cell.course = course;
    }
    if (collided) conflicts.push(course);
  }

  return { cells, conflicts };
}

/** 今日（依伺服器時間）的課程清單。 */
export function todayCourses(db: Database, studentId: string, term: Term, now: Date = new Date()): Course[] {
  const { cells } = timetableOf(db, studentId, term);
  const day = now.getDay();
  if (day < 1 || day > 5) return [];
  const seen = new Set<string>();
  const courses: Course[] = [];
  for (const cell of cells) {
    if (cell.day !== day || cell.course === null) continue;
    if (seen.has(cell.course.id)) continue;
    seen.add(cell.course.id);
    courses.push(cell.course);
  }
  return courses;
}

/** 把 `115-1` 轉成顯示用文字。 */
export function termLabel(term: Term): string {
  const match = /^(\d{3})-([12])$/u.exec(term);
  if (match === null) return term;
  const year = match[1] ?? '';
  const which = match[2] === '1' ? '上學期' : '下學期';
  return `${year} 學年度${which}`;
}