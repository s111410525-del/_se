import type { Course, Database, Term } from '../../types.js';
import { CATEGORIES } from '../../types.js';
import { escapeHtml } from '../../util/html.js';
import { describeSessions, listCourses, statsOf, type CourseFilters } from '../../services/courses.js';
import { findEnrollment, missingPrerequisites } from '../../services/enrollment.js';
import { termLabel } from '../../services/schedule.js';
import type { Student } from '../../types.js';
import { badge, card, csrfInput, emptyState, field, progress, selectField, table } from '../components.js';

export interface CourseListOptions {
  db: Database;
  currentTerm: Term;
  filters: CourseFilters;
  terms: Term[];
  teacherNames: { id: string; name: string }[];
  student: Student | undefined;
  csrfToken: string;
}

/** 課程查詢頁：篩選條件 + 課程清單。 */
export function courseListPage(options: CourseListOptions): string {
  const { db, filters, student, csrfToken } = options;
  const courses = listCourses(db, filters).sort(
    (a, b) => a.term.localeCompare(b.term) || a.code.localeCompare(b.code),
  );

  const termOptions = [
    { value: '', label: '全部學期' },
    ...options.terms.map((term) => ({ value: term, label: `${term}　${termLabel(term)}` })),
  ];
  const teacherOptions = [
    { value: '', label: '全部教師' },
    ...options.teacherNames.map((teacher) => ({ value: teacher.id, label: teacher.name })),
  ];
  const categoryOptions = [{ value: '', label: '全部類別' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))];

  const filterForm = `<form class="filters" method="get" action="/courses">
    ${field({ label: '關鍵字', name: 'q', value: filters.keyword ?? '', type: 'search', placeholder: '課程代號、課程名稱或教師' })}
    ${selectField('學期', 'term', termOptions, filters.term ?? '', { 'data-autosubmit': 'true' })}
    ${selectField('教師', 'teacher', teacherOptions, filters.teacherId ?? '', { 'data-autosubmit': 'true' })}
    ${selectField('類別', 'category', categoryOptions, filters.category ?? '', { 'data-autosubmit': 'true' })}
    <div class="field"><label for="f_open">&nbsp;</label><span style="display:flex;gap:6px;align-items:center">
      <input type="checkbox" id="f_open" name="open" value="1" style="width:auto"${filters.onlyOpen === true ? ' checked' : ''}>
      <span style="font-size:13px">只看還有名額</span></span></div>
    <button class="btn" type="submit">查詢</button>
    <a class="btn ghost" href="/courses">清除</a>
  </form>`;

  const items = courses
    .map((course) => {
      const stats = statsOf(db, course);
      const mine = student === undefined ? undefined : findEnrollment(db, student.id, course.id);
      const missing = student === undefined ? [] : missingPrerequisites(db, student, course);
      const tags: string[] = [badge(course.category, course.category === '必修' || course.category === '共同必修' ? 'brand' : 'muted')];
      if (course.open) tags.push(badge('選課中', 'ok'));
      else tags.push(badge('選課截止', 'muted'));
      if (mine !== undefined) tags.push(badge(mine.status === 'enrolled' ? '已選' : `候補 ${mine.queue}`, mine.status === 'enrolled' ? 'info' : 'warn'));
      for (const code of missing) tags.push(badge(`未修 ${code}`, 'err'));

      const actions: string[] = [`<a class="btn small ghost" href="/courses/${escapeHtml(course.id)}">課程詳情</a>`];
      if (student !== undefined && course.term === options.currentTerm && mine === undefined && missing.length === 0 && course.open) {
        actions.push(
          `<form method="post" action="/enrollment/${escapeHtml(course.id)}" style="margin:0">${csrfInput(csrfToken)}<button class="btn small" type="submit">${stats.seatsLeft > 0 ? '選課' : '加入候補'}</button></form>`,
        );
      }

      return `<li class="course-item">
        <h3>${escapeHtml(course.code)}　${escapeHtml(course.name)} <span style="font-weight:400;color:#667081;font-size:13px">${escapeHtml(course.englishName)}</span></h3>
        <div class="meta">${escapeHtml(stats.teacherName)}　${course.credits} 學分　${escapeHtml(course.term)}（${escapeHtml(termLabel(course.term))}）　${escapeHtml(describeSessions(course))}　${escapeHtml(course.location)}</div>
        <div class="foot">
          <div class="actions" style="flex:1">
            ${tags.join(' ')}
            <span style="font-size:13px;color:#667081">正取 ${stats.enrolled}/${stats.capacity}</span>
            ${stats.waitlisted > 0 ? `<span style="font-size:13px;color:#94620a">候補 ${stats.waitlisted}</span>` : ''}
            ${progress(stats.enrolled, stats.capacity)}
          </div>
          <div class="actions">${actions.join('')}</div>
        </div>
      </li>`;
    })
    .join('');

  const body = courses.length === 0 ? emptyState('查無符合條件的課程。') : `<ul class="course-list">${items}</ul>`;

  return card(`課程查詢（共 ${courses.length} 門）`, `${filterForm}${body}`);
}

export interface CourseDetailOptions {
  db: Database;
  course: Course;
  student: Student | undefined;
  csrfToken: string;
  currentTerm: Term;
  canEdit: boolean;
}

/** 課程詳情頁。 */
export function courseDetailPage(options: CourseDetailOptions): string {
  const { db, course, student } = options;
  const stats = statsOf(db, course);
  const sessions = course.sessions
    .map((session) => {
      const last = course.periods === 2 ? session.start + 1 : session.start;
      return `週${'一二三四五'[session.day - 1] ?? '?'} 第 ${session.start}-${last} 節`;
    })
    .join('、');
  const prereq = course.prerequisites.length === 0 ? '無' : course.prerequisites.join('、');

  const facts = `<table>
    <tbody>
      <tr><th style="width:130px">課程代號</th><td><b>${escapeHtml(course.code)}</b></td></tr>
      <tr><th>課程名稱</th><td>${escapeHtml(course.name)}（${escapeHtml(course.englishName)}）</td></tr>
      <tr><th>學分數</th><td>${course.credits} 學分</td></tr>
      <tr><th>課程類別</th><td>${escapeHtml(course.category)}</td></tr>
      <tr><th>開課學期</th><td>${escapeHtml(course.term)}　${escapeHtml(termLabel(course.term))}</td></tr>
      <tr><th>授課教師</th><td>${escapeHtml(stats.teacherName)}</td></tr>
      <tr><th>上課時間</th><td>${escapeHtml(sessions)}</td></tr>
      <tr><th>上課地點</th><td>${escapeHtml(course.location)}</td></tr>
      <tr><th>先修課程</th><td>${escapeHtml(prereq)}</td></tr>
      <tr><th>修課名額</th><td>正取 ${stats.enrolled} / ${stats.capacity}　候補 ${stats.waitlisted} 人</td></tr>
    </tbody>
  </table>`;

  const actions: string[] = [];
  if (student !== undefined && course.term === options.currentTerm) {
    const mine = findEnrollment(db, student.id, course.id);
    if (mine === undefined) {
      actions.push(
        `<form method="post" action="/enrollment/${escapeHtml(course.id)}" style="margin:0">
          ${csrfInput(options.csrfToken)}
          <button class="btn" type="submit">${stats.seatsLeft > 0 ? '立即選課' : '加入候補名單'}</button>
        </form>`,
      );
    } else {
      actions.push(
        `<span>${badge(mine.status === 'enrolled' ? '你已選修本課' : `候補順位 ${mine.queue}`, mine.status === 'enrolled' ? 'ok' : 'warn')}</span>`,
        `<form method="post" action="/enrollment/${escapeHtml(course.id)}/drop" style="margin:0" data-confirm="確定要退選《${escapeHtml(course.name)}》嗎？">
          ${csrfInput(options.csrfToken)}
          <button class="btn danger" type="submit">退選</button>
        </form>`,
      );
    }
  }
  if (options.canEdit) actions.push(`<a class="btn ghost" href="/admin/courses">編輯課程</a>`);

  const roster = options.canEdit
    ? card(
        '修課名單',
        table(
          [
            { header: '學號', render: (row) => escapeHtml(row.studentId) },
            { header: '姓名', render: (row) => escapeHtml(row.name) },
            { header: '系所班級', render: (row) => `${escapeHtml(row.department)}　${escapeHtml(row.className)}` },
            { header: '狀態', render: (row) => badge(row.status === 'enrolled' ? '正取' : `候補 ${row.queue}`, row.status === 'enrolled' ? 'ok' : 'warn') },
          ],
          rosterRows(db, course.id),
          { empty: '尚未有人選修' },
        ),
      )
    : '';

  return [card('課程資訊', facts), `<div class="card"><h2>選課</h2><div class="actions">${actions.join('')}</div></div>`, roster].join('');
}

interface RosterRowView {
  studentId: string;
  name: string;
  department: string;
  className: string;
  status: 'enrolled' | 'waitlisted';
  queue: number;
}

/** 依學號排序的修課名單。 */
function rosterRows(db: Database, courseId: string): RosterRowView[] {
  const rows: RosterRowView[] = [];
  for (const enrollment of db.enrollments) {
    if (enrollment.courseId !== courseId || enrollment.status === 'dropped') continue;
    const user = db.users.find((item) => item.id === enrollment.studentId);
    if (user === undefined || user.role !== 'student') continue;
    rows.push({
      studentId: user.studentId,
      name: user.name,
      department: user.department,
      className: user.className,
      status: enrollment.status,
      queue: enrollment.queue,
    });
  }
  return rows.sort((a, b) => a.studentId.localeCompare(b.studentId));
}