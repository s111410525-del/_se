import { badRequest, forbidden, notFound } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Course, Database, ScoreItem, ScoreRecord, Student, Term } from '../types.js';
import { findEnrollment } from './enrollment.js';

/** 及格分數。 */
export const PASS_SCORE = 60;

/** 字母等第對應的學期平均成績點數。 */
export const GRADE_POINTS: Record<string, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  F: 0,
};

export const LETTERS = Object.keys(GRADE_POINTS);

/** 由分數換算字母等第（台灣大學常見的五級制）。 */
export function letterOf(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= PASS_SCORE) return 'D';
  return 'F';
}

/** 由字母等第換算績分。 */
export function gradePointOf(letter: string): number {
  return GRADE_POINTS[letter] ?? 0;
}

/**
 * 依各項佔比計算總分。
 *
 * 權重總和不必剛好等於 100：只要同除以總權重即可得到正確的加權平均，
 * 這樣老師輸入「40 / 30 / 30」或「2 / 1」都合理。
 */
export function totalScoreOf(record: Pick<ScoreRecord, 'items'>): number {
  let weighted = 0;
  let total = 0;
  for (const item of record.items) {
    if (item.weight <= 0) continue;
    weighted += clampScore(item.score) * item.weight;
    total += item.weight;
  }
  if (total === 0) return 0;
  return round1(weighted / total);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 學期平均成績點數（GPA）。 */
export interface GpaSummary {
  credits: number;
  gpa: number;
}

/**
 * 學期平均成績點數（GPA）。
 *
 * 只計算「已公布」的成績：成績登錄與公布分開進行，未公布的成績不得
 * 透過 GPA 提前外洩給學生。
 */
export function gpaOf(db: Database, studentId: string, term: Term): GpaSummary {
  let credits = 0;
  let points = 0;
  for (const row of transcript(db, studentId)) {
    if (!row.record.published || row.course.term !== term) continue;
    credits += row.course.credits;
    points += gradePointOf(row.letter) * row.course.credits;
  }
  return { credits, gpa: credits === 0 ? 0 : round1(points / credits) };
}

/** 累計學期平均成績點數（僅計已公布成績）。 */
export function cumulativeGpa(db: Database, studentId: string): GpaSummary {
  let credits = 0;
  let points = 0;
  for (const row of transcript(db, studentId)) {
    if (!row.record.published) continue;
    credits += row.course.credits;
    points += gradePointOf(row.letter) * row.course.credits;
  }
  return { credits, gpa: credits === 0 ? 0 : round1(points / credits) };
}

/** 學生在某門課的成績檔案。 */
export function scoreRecordOf(db: Database, studentId: string, courseId: string): ScoreRecord | undefined {
  return db.scores.find((row) => row.studentId === studentId && row.courseId === courseId);
}

export interface TranscriptRow {
  course: Course;
  record: ScoreRecord;
  total: number;
  letter: string;
  gradePoint: number;
}

/** 學生的完整成績單（已登錄成績者才出現）。 */
export function transcript(db: Database, studentId: string): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  for (const record of db.scores) {
    if (record.studentId !== studentId) continue;
    const course = db.courses.find((item) => item.id === record.courseId);
    if (course === undefined) continue;
    const total = totalScoreOf(record);
    const letter = letterOf(total);
    rows.push({ course, record, total, letter, gradePoint: gradePointOf(letter) });
  }
  return rows.sort((a, b) => a.course.term.localeCompare(b.course.term) || a.course.code.localeCompare(b.course.code));
}

/** 學生在某學期「已公布」的成績。 */
export function publishedTranscript(db: Database, studentId: string, term: Term): TranscriptRow[] {
  return transcript(db, studentId).filter((row) => row.course.term === term && row.record.published);
}

/** 驗證並正規化成績項。 */
export function normalizeItems(items: ScoreItem[]): ScoreItem[] {
  if (items.length === 0) throw badRequest('至少需要一項評分');
  const names = new Set<string>();
  for (const item of items) {
    const name = item.name.trim();
    if (name === '') throw badRequest('評分名稱不得為空');
    if (name.length > 20) throw badRequest(`評分名稱「${name}」過長`);
    if (names.has(name)) throw badRequest(`評分名稱「${name}」重複`);
    names.add(name);
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) {
      throw badRequest(`「${name}」的分數必須介於 0 與 100 之間`);
    }
    if (!Number.isFinite(item.weight) || item.weight <= 0 || item.weight > 100) {
      throw badRequest(`「${name}」的權重必須大於 0 且不超過 100`);
    }
  }
  return items.map((item) => ({ name: item.name.trim(), score: round1(item.score), weight: item.weight }));
}

/**
 * 設定學生在某門課的成績。
 *
 * 權限檢查放在服務層：管理員可設定任何班級，授課教師只能設定自己的課，
 * 且只能設定該課的修課學生。
 */
export function setScore(
  db: Database,
  actor: { id: string; role: string },
  student: Student,
  courseId: string,
  items: ScoreItem[],
  now: Date = new Date(),
): ScoreRecord {
  const course = db.courses.find((item) => item.id === courseId);
  if (course === undefined) throw notFound(`找不到課程 ${courseId}`);
  if (actor.role === 'teacher' && course.teacherId !== actor.id) {
    throw forbidden('您只能為自己開的課程輸入成績');
  }
  if (findEnrollment(db, student.id, courseId) === undefined) {
    throw badRequest(`${student.name} 未選修《${course.name}》`);
  }

  const normalized = normalizeItems(items);
  const at = now.toISOString();
  const existing = scoreRecordOf(db, student.id, courseId);
  if (existing !== undefined) {
    existing.items = normalized;
    existing.updatedAt = at;
    return existing;
  }
  const record: ScoreRecord = {
    id: newId('scr'),
    studentId: student.id,
    courseId,
    items: normalized,
    published: false,
    updatedAt: at,
  };
  db.scores.push(record);
  return record;
}

/** 切換成績的公布狀態。 */
export function setPublished(db: Database, actor: { id: string; role: string }, recordId: string, published: boolean): ScoreRecord {
  const record = db.scores.find((row) => row.id === recordId);
  if (record === undefined) throw notFound('找不到這筆成績');
  if (actor.role === 'teacher') {
    const course = db.courses.find((item) => item.id === record.courseId);
    if (course === undefined || course.teacherId !== actor.id) throw forbidden('您只能公布自己課程的成績');
  }
  record.published = published;
  return record;
}

/** 某門課全部學生的成績（依學號排序）。 */
export function classGrades(db: Database, courseId: string): { student: Student; record: ScoreRecord | undefined; total: number; letter: string }[] {
  const course = db.courses.find((item) => item.id === courseId);
  if (course === undefined) throw notFound(`找不到課程 ${courseId}`);

  const rows: { student: Student; record: ScoreRecord | undefined; total: number; letter: string }[] = [];
  for (const enrollment of db.enrollments) {
    if (enrollment.courseId !== courseId || enrollment.status === 'dropped') continue;
    const user = db.users.find((item) => item.id === enrollment.studentId);
    if (user === undefined || user.role !== 'student') continue;
    const record = scoreRecordOf(db, user.id, courseId);
    const total = record === undefined ? 0 : totalScoreOf(record);
    rows.push({ student: user, record, total, letter: record === undefined ? '' : letterOf(total) });
  }
  return rows.sort((a, b) => a.student.studentId.localeCompare(b.student.studentId));
}