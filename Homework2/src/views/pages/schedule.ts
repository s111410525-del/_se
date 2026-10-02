import type { Course, Database, Term } from '../../types.js';
import { DAY_LABELS, DAYS, PERIODS, PERIOD_TIMES } from '../../types.js';
import { escapeHtml } from '../../util/html.js';
import { describeSessions, statsOf } from '../../services/courses.js';
import { timetableOf } from '../../services/schedule.js';
import { badge, card, emptyState } from '../components.js';

/** 依課程代號產生穩定的色票，讓課表容易辨識。 */
function colorFor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash * 31 + code.charCodeAt(i)) % 360;
  return `hsl(${hash} 55% 40%)`;
}

export type ScheduleOptions =
  | { mode: 'student'; db: Database; studentId: string; term: Term; courses: Course[] }
  | { mode: 'teacher'; db: Database; teacherId: string; term: Term };

/**
 * 課表頁。
 *
 * 表格固定 5 欄（週一～週五）× 12 列（節次），有課的格子顯示色塊，
 * 兩節課會自動佔用兩列；撞堂時由第一個填入者保留，其餘標示衝突。
 */
export function schedulePage(options: ScheduleOptions): string {
  if (options.mode === 'teacher') return teacherSchedule(options);
  return studentSchedule(options);
}

function studentSchedule(options: ScheduleOptions & { mode: 'student' }): string {
  const { db, studentId, term, courses } = options;
  const { cells, conflicts } = timetableOf(db, studentId, term);
  const used = cells.filter((cell) => cell.course !== null);
  const periods = new Set(used.map((cell) => cell.period));

  const header = `<tr><th class="period-col">節次</th>${DAYS.map((day) => `<th>${escapeHtml(DAY_LABELS[day])}</th>`).join('')}</tr>`;

  const rows = PERIODS.map((period) => {
    const columns = DAYS.map((day) => {
      const cell = cells.find((item) => item.day === day && item.period === period);
      if (cell === undefined || cell.course === null) return '<td class="empty-cell"></td>';
      return `<td><div class="course-block" style="background:${colorFor(cell.course.code)}">`
        + `<b>${escapeHtml(cell.course.code)}</b><span>${escapeHtml(cell.course.name)}</span></div></td>`;
    }).join('');
    return `<tr><td class="period-label">第 ${period} 節<br><small>${escapeHtml(PERIOD_TIMES[period])}</small></td>${columns}</tr>`;
  }).join('');

  const summary = `<div class="grid cols-4">
    <div class="stat"><div class="label">上課節數</div><div class="value">${used.length}</div></div>
    <div class="stat"><div class="label">使用節次</div><div class="value">${periods.size} / ${PERIODS.length}</div></div>
    <div class="stat"><div class="label">學期</div><div class="value" style="font-size:19px">${escapeHtml(term)}</div></div>
    <div class="stat ${conflicts.length === 0 ? 'ok' : 'err'}"><div class="label">衝堂狀態</div><div class="value" style="font-size:19px">${conflicts.length === 0 ? '無衝突' : `${conflicts.length} 門`}</div></div>
  </div>`;

  const warning = conflicts.length === 0
    ? ''
    : `<div class="alert alert-error" role="alert"><b>!</b> 有課堂時段重疊：${conflicts
        .map((course) => escapeHtml(`${course.code} ${course.name}`))
        .join('、')}，請至選課頁確認。</div>`;

  const list = courses.length === 0
    ? emptyState('本學期尚未選修任何課程。')
    : `<ul class="lesson-list">${courses
        .map((course) => {
          const stats = statsOf(db, course);
          return `<li class="lesson"><div class="time">${escapeHtml(describeSessions(course))}　${escapeHtml(course.location)}</div>`
            + `<h4>${escapeHtml(course.code)}　${escapeHtml(course.name)} ${badge(`${course.credits} 學分`, 'muted')}</h4>`
            + `<div style="font-size:13px;color:#667081">${escapeHtml(stats.teacherName)}　正取 ${stats.enrolled}/${stats.capacity}</div></li>`;
        })
        .join('')}</ul>`;

  return [
    summary,
    warning,
    card('本週課表', `<table class="timetable">${header}<tbody>${rows}</tbody></table>`),
    card(`修習課程（${courses.length} 門）`, list),
  ].join('');
}

function teacherSchedule(options: ScheduleOptions & { mode: 'teacher' }): string {
  const { db, teacherId, term } = options;
  const courses = db.courses.filter((course) => course.term === term && course.teacherId === teacherId);

  if (courses.length === 0) return card('本學期課程', emptyState('本學期尚未開課。'));

  const header = `<tr><th class="period-col">節次</th>${DAYS.map((day) => `<th>${escapeHtml(DAY_LABELS[day])}</th>`).join('')}</tr>`;
  const rows = PERIODS.map((period) => {
    const columns = DAYS.map((day) => {
      const cell = courses.filter(
        (course) => course.sessions.some((session) => session.day === day && period >= session.start && period <= session.start + course.periods - 1),
      );
      if (cell.length === 0) return '<td class="empty-cell"></td>';
      return cell
        .map(
          (course) =>
            `<div class="course-block" style="background:${colorFor(course.code)}"><b>${escapeHtml(course.code)}</b><span>${escapeHtml(course.location)}</span></div>`,
        )
        .join('');
    }).join('');
    return `<tr><td class="period-label">第 ${period} 節<br><small>${escapeHtml(PERIOD_TIMES[period])}</small></td>${columns}</tr>`;
  }).join('');

  const list = `<ul class="lesson-list">${courses
    .map((course) => {
      const stats = statsOf(db, course);
      return `<li class="lesson"><div class="time">${escapeHtml(describeSessions(course))}　${escapeHtml(course.location)}</div>`
        + `<h4>${escapeHtml(course.code)}　${escapeHtml(course.name)}</h4>`
        + `<div style="font-size:13px;color:#667081">${course.credits} 學分　正取 ${stats.enrolled}/${stats.capacity}　候補 ${stats.waitlisted} 人</div>`
        + `<p style="margin:6px 0 0"><a class="btn small ghost" href="/grades/course/${escapeHtml(course.id)}">成績管理</a></p></li>`;
    })
    .join('')}</ul>`;

  return [
    card('教師課表', `<table class="timetable">${header}<tbody>${rows}</tbody></table>`),
    card(`本學期課程（${courses.length} 門）`, list),
  ].join('');
}