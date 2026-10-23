import type { Course, Database, Enrollment, Student, Term } from '../../types.js';
import { escapeHtml } from '../../util/html.js';
import { describeSessions, findCourse, listCourses, statsOf } from '../../services/courses.js';
import {
  activeEnrollmentsOf,
  conflictingCourses,
  missingPrerequisites,
  registeredCredits,
} from '../../services/enrollment.js';
import { termLabel } from '../../services/schedule.js';
import { badge, card, csrfInput, emptyState, progress, stat, table } from '../components.js';

export interface EnrollmentPageOptions {
  db: Database;
  student: Student;
  currentTerm: Term;
  creditLimit: number;
  csrfToken: string;
}

/** 選課頁：上半部是已選課程，下半部是可選課程。 */
export function enrollmentPage(options: EnrollmentPageOptions): string {
  const { db, student, currentTerm, creditLimit, csrfToken } = options;
  const rows = activeEnrollmentsOf(db, student.id, currentTerm);
  const credits = registeredCredits(db, student.id, currentTerm);
  const waitlist = rows.filter((row) => row.status === 'waitlisted').length;
  const enrolledCredits = rows
    .filter((row) => row.status === 'enrolled')
    .reduce((sum, row) => sum + (findCourse(db, row.courseId)?.credits ?? 0), 0);

  const overview = `<div class="grid cols-4">
    ${stat('已選學分', `${enrolledCredits} 學分`, `學分上限 ${creditLimit} 學分`)}
    ${stat('候補學分', `${credits - enrolledCredits} 學分`, waitlist === 0 ? '目前沒有候補' : `${waitlist} 門候補中`)}
    ${stat('正取課程', `${enrolledCredits === 0 ? 0 : rows.length - waitlist} 門`, '')}
    ${stat('修課上限', `${Math.round((enrolledCredits / creditLimit) * 100)}%`, enrolledCredits >= creditLimit ? '已達上限' : '仍可選課')}
  </div>`;

  const myRows = rows
    .map((row) => ({ enrollment: row, course: findCourse(db, row.courseId) }))
    .filter((row): row is { enrollment: Enrollment; course: Course } => row.course !== undefined)
    .sort((a, b) => a.course.code.localeCompare(b.course.code));

  const mine = table(
    [
      { header: '狀態', render: (row) => badge(row.enrollment.status === 'enrolled' ? '正取' : `候補 ${row.enrollment.queue}`, row.enrollment.status === 'enrolled' ? 'ok' : 'warn') },
      { header: '課程', render: (row) => `<b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}` },
      { header: '學分', align: 'num', render: (row) => String(row.course.credits) },
      { header: '時間', render: (row) => escapeHtml(describeSessions(row.course)) },
      { header: '地點', render: (row) => escapeHtml(row.course.location) },
      { header: '教師', render: (row) => escapeHtml(statsOf(db, row.course).teacherName) },
      {
        header: '操作',
        render: (row) => `<form method="post" action="/enrollment/${escapeHtml(row.course.id)}/drop" style="margin:0" data-confirm="退選《${escapeHtml(row.course.name)}》後名額將釋出給候補同學，確定嗎？">
          ${csrfInput(csrfToken)}
          <button class="btn small danger" type="submit">退選</button>
        </form>`,
      },
    ],
    myRows,
    { empty: '尚未選任何課程，請於下方課程清單中選課。' },
  );

  const available = listCourses(db, { term: currentTerm })
    .filter((course) => !rows.some((row) => row.courseId === course.id))
    .filter((course) => course.open)
    .map((course) => ({ course, stats: statsOf(db, course), clash: conflictingCourses(db, student, course), missing: missingPrerequisites(db, student, course) }))
    .sort((a, b) => a.course.code.localeCompare(b.course.code));

  const list = available.length === 0
    ? emptyState('本學期已無可選課程。')
    : `<ul class="course-list">${available
        .map(({ course, stats, clash, missing }) => {
          const blocked = clash.length > 0 || missing.length > 0;
          const reason: string[] = [];
          for (const item of missing) reason.push(`未修先修 ${item}`);
          for (const item of clash) reason.push(`與 ${item.code} ${item.name} 衝堂`);
          if (credits + course.credits > creditLimit) reason.push('超過學分上限');

          const action = blocked
            ? `<span class="badge err">${escapeHtml(reason[0] ?? '無法選課')}</span>`
            : `<form method="post" action="/enrollment/${escapeHtml(course.id)}" style="margin:0">
                ${csrfInput(csrfToken)}
                <button class="btn small" type="submit"${stats.seatsLeft > 0 ? '' : ' data-confirm="本課名額已滿，確定要加入候補名單嗎？"'}>${stats.seatsLeft > 0 ? '選課' : '加入候補'}</button>
              </form>`;

          return `<li class="course-item">
            <h3>${escapeHtml(course.code)}　${escapeHtml(course.name)}</h3>
            <div class="meta">${escapeHtml(stats.teacherName)}　${course.credits} 學分　${escapeHtml(course.category)}　${escapeHtml(describeSessions(course))}　${escapeHtml(course.location)}</div>
            <div class="foot">
              <div class="actions" style="flex:1">
                <span style="font-size:13px;color:#667081">正取 ${stats.enrolled}/${stats.capacity}　候補 ${stats.waitlisted}</span>
                ${progress(stats.enrolled, stats.capacity)}
                ${blocked ? '' : stats.seatsLeft > 0 ? badge(`尚餘 ${stats.seatsLeft} 席`, 'ok') : badge('名額已滿', 'warn')}
              </div>
              <div class="actions">${action}<a class="btn small ghost" href="/courses/${escapeHtml(course.id)}">詳情</a></div>
            </div>
          </li>`;
        })
        .join('')}</ul>`;

  return [
    overview,
    card(`已選課程（${currentTerm}　${termLabel(currentTerm)}）`, mine),
    card('可選課程', `${list}<p class="note" style="margin-top:14px">學分上限 ${creditLimit} 學分；選課採先到先取得正取，額滿後自動進入候補名單，退選時依順位遞補。</p>`),
  ].join('');
}