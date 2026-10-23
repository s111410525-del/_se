import type { Course, Database, Term } from '../../types.js';
import { CATEGORIES, DAYS, PERIODS, TERMS } from '../../types.js';
import { escapeHtml, formatDateTime } from '../../util/html.js';
import { listCourses, statsOf } from '../../services/courses.js';
import { totalScoreOf } from '../../services/grades.js';
import { balanceOf } from '../../services/fees.js';
import { badge, card, csrfInput, field, selectField, stat, table } from '../components.js';

export interface AdminOverviewOptions {
  db: Database;
  currentTerm: Term;
  notices: number;
  users: number;
}

/** 管理首頁的統計（dashboard 頁另有詳細內容，這裡是後臺導覽）。 */
export function adminOverview(options: AdminOverviewOptions): string {
  const { db } = options;
  return `<div class="grid cols-4">
    ${stat('課程', `${db.courses.length} 門`, `本學期 ${db.courses.filter((c) => c.term === options.currentTerm).length} 門`)}
    ${stat('使用者', `${options.users} 人`, '學生、教師與教職員')}
    ${stat('公告', `${options.notices} 則`, '含置頂公告')}
    ${stat('繳費單', `${db.bills.length} 張`, `未繳清 ${db.bills.filter((bill) => balanceOf(bill) > 0).length} 張`, 'warn')}
  </div>`;
}

export interface AdminCourseOptions {
  db: Database;
  courses: Course[];
  csrfToken: string;
  currentTerm: Term;
}

/** 課程管理：列表 + 開課 + 切換選課狀態。 */
export function adminCoursesPage(options: AdminCourseOptions): string {
  const { db, courses, csrfToken } = options;
  const teachers = db.users.filter((user) => user.role === 'teacher');
  const teacherOptions = teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.name}（${teacher.title}）` }));

  const list = table(
    [
      { header: '代號', render: (row) => `<a href="/courses/${escapeHtml(row.id)}"><b>${escapeHtml(row.code)}</b></a>` },
      { header: '名稱', render: (row) => escapeHtml(row.name) },
      { header: '學期', render: (row) => escapeHtml(row.term) },
      { header: '類別', render: (row) => escapeHtml(row.category) },
      { header: '學分', align: 'num', render: (row) => String(row.credits) },
      { header: '正取/名額', align: 'num', render: (row) => `${statsOf(db, row).enrolled}/${row.capacity}` },
      { header: '候補', align: 'num', render: (row) => String(statsOf(db, row).waitlisted) },
      { header: '狀態', render: (row) => badge(row.open ? '選課中' : '選課截止', row.open ? 'ok' : 'muted') },
      {
        header: '操作',
        render: (row) => `<div class="actions">
          <form method="post" action="/admin/courses/${escapeHtml(row.id)}/toggle" style="margin:0">${csrfInput(csrfToken)}
            <button class="btn small ghost" type="submit">${row.open ? '關閉選課' : '開放選課'}</button></form>
          <form method="post" action="/admin/courses/${escapeHtml(row.id)}/capacity" style="margin:0">${csrfInput(csrfToken)}
            <input type="number" name="capacity" value="${row.capacity}" min="0" max="500" style="width:82px">
            <button class="btn small ghost" type="submit">名額</button></form>
        </div>`,
      },
    ],
    courses,
    { empty: '查無課程' },
  );

  const dayOptions = DAYS.map((day) => ({ value: String(day), label: `週${'一二三四五'[day - 1] ?? ''}` }));
  const periodOptions = PERIODS.map((period) => ({ value: String(period), label: `第 ${period} 節` }));

  const create = `<form class="stack" method="post" action="/admin/courses" style="max-width:none">
    <div class="grid cols-2">
      ${field({ label: '課程代號', name: 'code', required: true, placeholder: '例如 CS450' })}
      ${field({ label: '課程名稱', name: 'name', required: true })}
      ${field({ label: '英文名稱', name: 'englishName', required: true })}
      ${field({ label: '學分數', name: 'credits', type: 'number', required: true, value: '3', min: 0, max: 10 })}
      ${selectField('學期', 'term', TERMS.map((term) => ({ value: term, label: term })), options.currentTerm)}
      ${selectField('類別', 'category', CATEGORIES.map((c) => ({ value: c, label: c })), '選修')}
      ${selectField('授課教師', 'teacherId', teacherOptions, teacherOptions[0]?.value ?? '')}
      ${field({ label: '修課人數上限', name: 'capacity', type: 'number', required: true, value: '40', min: 0, max: 500 })}
      ${field({ label: '上課地點', name: 'location', required: true, placeholder: '例如 資訊大樓 A305' })}
      ${selectField('上課節次（星期）', 'day', dayOptions, '1')}
      ${selectField('上課節次（節次）', 'start', periodOptions, '3')}
      ${selectField('每次上課節數', 'periods', [{ value: '1', label: '1 節' }, { value: '2', label: '2 節' }], '2')}
      ${field({ label: '先修課程代號', name: 'prerequisites', hint: '以空白或頓號分隔，例如：CS201、CS210' })}
    </div>
    <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
    <div class="actions"><button class="btn" type="submit">開課</button></div>
  </form>`;

  return [
    card(`課程管理（${courses.length} 門）`, list),
    card('新增課程', create),
  ].join('');
}

export interface AdminUsersOptions {
  db: Database;
  keyword: string;
  role: string;
}

/** 使用者名冊。 */
export function adminUsersPage(options: AdminUsersOptions): string {
  const { db } = options;
  const keyword = options.keyword.trim().toLowerCase();
  const users = db.users.filter((user) => {
    if (options.role !== '' && user.role !== options.role) return false;
    if (keyword === '') return true;
    return user.name.toLowerCase().includes(keyword)
      || user.username.toLowerCase().includes(keyword)
      || user.email.toLowerCase().includes(keyword);
  });

  const list = table(
    [
      { header: '帳號', render: (user) => `<code>${escapeHtml(user.username)}</code>` },
      { header: '姓名', render: (user) => escapeHtml(user.name) },
      { header: '角色', render: (user) => badge(user.role === 'student' ? '學生' : user.role === 'teacher' ? '教師' : '教職員', user.role === 'admin' ? 'info' : 'muted') },
      {
        header: '識別碼',
        render: (user) => (user.role === 'student' ? escapeHtml(user.studentId) : escapeHtml(user.employeeId)),
      },
      {
        header: '系所 / 單位',
        render: (user) => escapeHtml(user.role === 'admin' ? '教務處' : user.department),
      },
      {
        header: '已選學分 / 成績',
        render: (user) => {
          if (user.role !== 'student') return '—';
          const credits = db.enrollments
            .filter((row) => row.studentId === user.id && row.status !== 'dropped')
            .reduce((sum, row) => sum + (db.courses.find((c) => c.id === row.courseId)?.credits ?? 0), 0);
          const scores = db.scores.filter((row) => row.studentId === user.id);
          return `${credits} 學分　${scores.length} 門有成績`;
        },
      },
      { header: '狀態', render: (user) => badge(user.active ? '正常' : '停用', user.active ? 'ok' : 'muted') },
    ],
    users,
    { empty: '查無使用者' },
  );

  const filters = `<form class="filters" method="get" action="/admin/users">
    ${field({ label: '關鍵字', name: 'q', value: options.keyword, type: 'search', placeholder: '帳號、姓名或信箱' })}
    ${selectField(
      '角色',
      'role',
      [
        { value: '', label: '全部' },
        { value: 'student', label: '學生' },
        { value: 'teacher', label: '教師' },
        { value: 'admin', label: '教職員' },
      ],
      options.role,
      { 'data-autosubmit': 'true' },
    )}
    <button class="btn" type="submit">查詢</button>
  </form>`;

  return card(`使用者名冊（${users.length} 人）`, `${filters}${list}`);
}

export interface AdminCourseEditOptions {
  db: Database;
  course: Course;
  csrfToken: string;
  error: string | null;
  form: Record<string, string>;
}

/** 課程編輯表單。 */
export function adminCourseEditPage(options: AdminCourseEditOptions): string {
  const { course } = options;
  const value = (name: string, fallback: string): string => options.form[name] ?? fallback;
  const teachers = options.db.users.filter((user) => user.role === 'teacher');
  const alert = options.error === null ? '' : `<div class="alert alert-error" role="alert"><b>!</b> ${escapeHtml(options.error)}</div>`;

  const create = `<form class="stack" method="post" action="/admin/courses/${escapeHtml(course.id)}" style="max-width:none">
    ${alert}
    <div class="grid cols-2">
      ${field({ label: '課程代號', name: 'code', value: value('code', course.code), required: true })}
      ${field({ label: '課程名稱', name: 'name', value: value('name', course.name), required: true })}
      ${field({ label: '英文名稱', name: 'englishName', value: value('englishName', course.englishName), required: true })}
      ${field({ label: '學分數', name: 'credits', type: 'number', value: value('credits', String(course.credits)), required: true, min: 0, max: 10 })}
      ${selectField('學期', 'term', TERMS.map((t) => ({ value: t, label: t })), value('term', course.term))}
      ${selectField('類別', 'category', CATEGORIES.map((c) => ({ value: c, label: c })), value('category', course.category))}
      ${selectField('授課教師', 'teacherId', teachers.map((t) => ({ value: t.id, label: t.name })), value('teacherId', course.teacherId))}
      ${field({ label: '修課人數上限', name: 'capacity', type: 'number', value: value('capacity', String(course.capacity)), required: true, min: 0, max: 500 })}
      ${field({ label: '上課地點', name: 'location', value: value('location', course.location), required: true })}
      ${field({ label: '先修課程代號', name: 'prerequisites', value: value('prerequisites', course.prerequisites.join('、')) })}
      ${selectField('選課狀態', 'open', [{ value: '1', label: '開放選課' }, { value: '0', label: '選課截止' }], course.open ? '1' : '0')}
    </div>
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <div class="actions"><button class="btn" type="submit">儲存課程</button><a class="btn ghost" href="/admin/courses">返回</a></div>
  </form>`;

  return card(`編輯課程 ${course.code}`, create);
}

export interface AdminActivityOptions {
  db: Database;
}

/** 系統動態：最近的繳費與公告。 */
export function adminActivityPage(options: AdminActivityOptions): string {
  const { db } = options;
  const payments = db.payments
    .slice()
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 10)
    .map((payment) => {
      const user = db.users.find((item) => item.id === payment.studentId);
      return { payment, name: user?.name ?? '—' };
    });

  const paymentTable = table(
    [
      { header: '收據序號', render: (row) => `<code>${escapeHtml(row.payment.serial)}</code>` },
      { header: '學生', render: (row) => escapeHtml(row.name) },
      { header: '金額', align: 'num', render: (row) => String(row.payment.amount) },
      { header: '方式', render: (row) => escapeHtml(row.payment.method) },
      { header: '時間', render: (row) => escapeHtml(formatDateTime(row.payment.paidAt)) },
    ],
    payments,
    { empty: '尚無繳費紀錄' },
  );

  const courseRanking = listCourses(db)
    .map((course) => ({ course, stats: statsOf(db, course) }))
    .sort((a, b) => b.stats.enrolled - a.stats.enrolled)
    .slice(0, 10);

  const rankingTable = table(
    [
      { header: '學期', render: (row) => escapeHtml(row.course.term) },
      { header: '課程', render: (row) => `<b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}` },
      { header: '學分', align: 'num', render: (row) => String(row.course.credits) },
      { header: '正取', align: 'num', render: (row) => `${row.stats.enrolled}/${row.stats.capacity}` },
      { header: '候補', align: 'num', render: (row) => String(row.stats.waitlisted) },
    ],
    courseRanking,
    { empty: '尚無課程' },
  );

  const gradeRows = db.courses
    .filter((course) => course.term === '115-1')
    .map((course) => {
      const records = db.scores
        .filter((record) => record.courseId === course.id)
        .map((record) => totalScoreOf(record));
      const average = records.length === 0 ? null : records.reduce((a, b) => a + b, 0) / records.length;
      return { course, count: records.length, average };
    })
    .filter((row) => row.count > 0);

  const gradeTable = table(
    [
      { header: '課程', render: (row) => `<b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}` },
      { header: '已評分', align: 'num', render: (row) => `${row.count} 人` },
      { header: '平均分數', align: 'num', render: (row) => (row.average === null ? '—' : row.average.toFixed(1)) },
    ],
    gradeRows,
    { empty: '本學期尚未有成績' },
  );

  return [card('最近繳費紀錄', paymentTable), card('選課人數排行', rankingTable), card('成績平均一覽', gradeTable)].join('');
}