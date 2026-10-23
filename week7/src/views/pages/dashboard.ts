import type { Course, Database, Student } from '../../types.js';
import { escapeHtml, formatDateTime } from '../../util/html.js';
import { advisorOf, teacherName } from '../../services/accounts.js';
import { balanceOf, billOf, statusOf, type BillStatus } from '../../services/fees.js';
import { activeEnrollmentsOf, registeredCredits, termStats } from '../../services/enrollment.js';
import { findCourse, statsOf } from '../../services/courses.js';
import { cumulativeGpa, gpaOf } from '../../services/grades.js';
import { pinnedNotices } from '../../services/notices.js';
import { termLabel, todayCourses } from '../../services/schedule.js';
import { badge, card, descriptionList, emptyState, progress, stat, table } from '../components.js';

function noticeList(db: Database): string {
  const notices = pinnedNotices(db);
  if (notices.length === 0) return emptyState('目前沒有置頂公告');
  return `<ul class="lesson-list">${notices
    .map(
      (notice) => `<li class="lesson"><div class="time">${escapeHtml(notice.category)}　${formatDateTime(notice.publishedAt)}</div>
        <h4><a href="/notices/${escapeHtml(notice.id)}">${escapeHtml(notice.title)}</a></h4></li>`,
    )
    .join('')}</ul>`;
}

/** 學生首頁。 */
export function studentDashboard(
  db: Database,
  student: Student,
  currentTerm: string,
  creditLimit: number,
  now: Date,
): string {
  const enrolled = activeEnrollmentsOf(db, student.id, currentTerm);
  const credits = registeredCredits(db, student.id, currentTerm);
  const term = gpaOf(db, student.id, currentTerm);
  const cumulative = cumulativeGpa(db, student.id);
  const bill = billOf(db, student.id, currentTerm);
  const balance = bill === undefined ? 0 : balanceOf(bill);
  const billStatus: BillStatus = bill === undefined ? 'paid' : statusOf(bill, now);
  const today = todayCourses(db, student.id, currentTerm, now);
  const advisor = advisorOf(db, student);

  const waitlisted = enrolled.filter((row) => row.status === 'waitlisted').length;

  const overview = `<div class="grid cols-4">
    ${stat('本學期學分', `${credits} / ${creditLimit}`, `${currentTerm}　${termLabel(currentTerm)}`)}
    ${stat('已選課', `${enrolled.length - waitlisted} 門`, waitlisted > 0 ? `另有 ${waitlisted} 門候補中` : '尚無候補課程')}
    ${stat('平均成績 GPA', term.gpa.toFixed(2), `累計 ${cumulative.gpa.toFixed(2)}（${cumulative.credits} 學分）`)}
    ${stat('待繳費用', balance === 0 ? '已繳清' : `NT$ ${balance.toLocaleString('zh-TW')}`, billStatus === 'overdue' ? '已逾期未繳' : `期限 ${bill?.dueDate ?? '—'}`, balance === 0 ? 'ok' : billStatus === 'overdue' ? 'err' : 'warn')}
  </div>`;

  const todayBlock = `<div class="card">
    <h2>今日課程（${today.length === 0 ? '今天沒有課' : `${today.length} 門課`}）</h2>
    ${
      today.length === 0
        ? emptyState('今天沒有安排課程，可以到圖書館或實驗室自習。')
        : `<ul class="lesson-list">${today
            .map((course) => {
              const times = course.sessions.map((session) => `週${'一二三四五'[session.day - 1] ?? ''}第 ${session.start}-${course.periods === 2 ? session.start + 1 : session.start} 節`).join('、');
              return `<li class="lesson"><div class="time">${escapeHtml(times)}　${escapeHtml(course.location)}</div>
                <h4>${escapeHtml(course.code)}　${escapeHtml(course.name)}</h4>
                <div style="font-size:13px;color:#667081">授課教師：${escapeHtml(teacherName(db, course.teacherId))}</div></li>`;
            })
            .join('')}</ul>`
    }
  </div>`;

  const profile = `<div class="card">
    <h2>我的資料</h2>
    ${descriptionList([
      ['學號', escapeHtml(student.studentId)],
      ['系所 / 班級', `${escapeHtml(student.department)}　${escapeHtml(student.className)}`],
      ['年級', `${student.gradeYear} 年級`],
      ['電子郵件', escapeHtml(student.email)],
      ['聯絡電話', student.phone === '' ? '尚未填寫' : escapeHtml(student.phone)],
      ['導師', advisor === undefined ? '尚未指派' : `${escapeHtml(advisor.name)}`],
    ])}
    <p style="margin:12px 0 0"><a class="btn ghost small" href="/profile">編輯個人資料</a></p>
  </div>`;

  return [
    overview,
    `<div class="grid cols-2">${todayBlock}${card('校園公告', noticeList(db))}</div>`,
    profile,
  ].join('');
}

/** 教師首頁。 */
export function teacherDashboard(db: Database, teacherId: string, currentTerm: string): string {
  const mine = db.courses.filter((course) => course.teacherId === teacherId);
  const current = mine.filter((course) => course.term === currentTerm);
  const records = db.scores.filter((row) => mine.some((course) => course.id === row.courseId));
  const pending = current.filter((course) => {
    const enrolled = db.enrollments.filter((row) => row.courseId === course.id && row.status !== 'dropped');
    return enrolled.some((row) => !records.some((rec) => rec.studentId === row.studentId));
  });

  const overview = `<div class="grid cols-4">
    ${stat('本學期開課', `${current.length} 門`, termLabel(currentTerm))}
    ${stat('修課學生', `${current.reduce((acc, course) => acc + statsOf(db, course).enrolled, 0)} 人次`, '不含候補')}
    ${stat('待輸入成績', `${pending.length} 門課`, pending.length === 0 ? '全部完成' : '請盡速處理')}
    ${stat('歷史課程', `${mine.length - current.length} 門`, '已結束學期')}
  </div>`;

  const rows = current
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((course) => statsOf(db, course));

  const courseTable = table(
    [
      { header: '課程', render: (_row, index) => {
        const course = current[index];
        return course === undefined ? '' : `<a href="/courses/${escapeHtml(course.id)}"><b>${escapeHtml(course.code)}</b>　${escapeHtml(course.name)}</a>`;
      } },
      { header: '類別', render: (_row, index) => escapeHtml(current[index]?.category ?? '') },
      { header: '學分', align: 'num', render: (_row, index) => String(current[index]?.credits ?? 0) },
      { header: '正取 / 名額', align: 'num', render: (row) => `${row.enrolled} / ${row.capacity}` },
      { header: '候補', align: 'num', render: (row) => String(row.waitlisted) },
      { header: '填表率', render: (row) => progress(row.enrolled, row.capacity) },
      {
        header: '操作',
        render: (_row, index) => {
          const course = current[index];
          return course === undefined ? '' : `<div class="actions"><a class="btn small ghost" href="/grades/course/${escapeHtml(course.id)}">成績管理</a><a class="btn small ghost" href="/schedule">課表</a></div>`;
        },
      },
    ],
    rows,
    { empty: '本學期尚未開課' },
  );

  return [
    overview,
    card('本學期課程', courseTable),
    card('待處理事項', pending.length === 0 ? emptyState('所有課程的成績都已輸入完成。') : `<ul class="lesson-list">${pending
      .map((course) => `<li class="lesson"><h4>${escapeHtml(course.code)}　${escapeHtml(course.name)}</h4><div class="time">尚有學生未輸入成績</div><p style="margin:8px 0 0"><a class="btn small" href="/grades/course/${escapeHtml(course.id)}">前往輸入</a></p></li>`)
      .join('')}</ul>`),
  ].join('');
}

/** 教職員首頁。 */
export function adminDashboard(db: Database, currentTerm: string): string {
  const stats = termStats(db, currentTerm);
  const students = db.users.filter((user) => user.role === 'student').length;
  const teachers = db.users.filter((user) => user.role === 'teacher').length;
  const courses = db.courses.filter((course) => course.term === currentTerm);
  const waitlisted = db.enrollments.filter((row) => {
    if (row.status !== 'waitlisted') return false;
    const course = findCourse(db, row.courseId);
    return course !== undefined && course.term === currentTerm;
  });

  const overview = `<div class="grid cols-4">
    ${stat('在校學生', `${students} 人`, `教師 ${teachers} 人`)}
    ${stat('開課數', `${courses.length} 門`, termLabel(currentTerm))}
    ${stat('選課人次', `${stats.total}`, `總學分 ${stats.credits}`)}
    ${stat('候補人次', `${stats.waitlisted}`, stats.waitlisted > 0 ? '注意是否需加開名額' : '目前無候補', stats.waitlisted > 0 ? 'warn' : '')}
  </div>`;

  const hot = db.courses
    .filter((course) => course.term === currentTerm)
    .map((course) => ({ course, ...statsOf(db, course) }))
    .sort((a, b) => b.enrolled / b.capacity - a.enrolled / a.capacity || b.enrolled - a.enrolled)
    .slice(0, 6);

  const hotTable = table(
    [
      { header: '課程', render: (row) => `<a href="/courses/${escapeHtml(row.course.id)}"><b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}</a>` },
      { header: '教師', render: (row) => escapeHtml(row.teacherName) },
      { header: '正取 / 名額', align: 'num', render: (row) => `${row.enrolled} / ${row.capacity}` },
      { header: '候補', align: 'num', render: (row) => String(row.waitlisted) },
      { header: '選課率', render: (row) => progress(row.enrolled, row.capacity) },
    ],
    hot,
    { empty: '本學期尚未開課' },
  );

  const waitlistRows: { course: Course; queue: number }[] = [];
  for (const row of waitlisted) {
    const course = findCourse(db, row.courseId);
    if (course !== undefined) waitlistRows.push({ course, queue: row.queue });
  }
  waitlistRows.sort((a, b) => b.queue - a.queue);

  const waitTable = table(
    [
      { header: '課程', render: (row) => `<b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}` },
      { header: '順位', align: 'num', render: (row) => String(row.queue) },
      { header: '狀態', render: (row) => badge(`候補第 ${row.queue} 位`, 'warn') },
    ],
    waitlistRows.slice(0, 8),
    { empty: '目前沒有候補名單' },
  );

  return [
    overview,
    card('熱門課程（前 6 名）', hotTable),
    card('候補名單', waitTable),
    `<div class="card"><h2>快捷操作</h2><div class="actions">
      <a class="btn" href="/admin/courses">課程管理</a>
      <a class="btn ghost" href="/admin/notices">公告管理</a>
      <a class="btn ghost" href="/admin/users">使用者名冊</a>
      <a class="btn ghost" href="/admin/fees">繳費總覽</a>
      <a class="btn ghost" href="/admin/grades">成績查詢</a>
    </div></div>`,
  ].join('');
}