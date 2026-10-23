import type { Course, Database, ScoreItem, ScoreRecord, Student, Term } from '../../types.js';
import { escapeHtml, formatDate, formatScore } from '../../util/html.js';
import {
  classGrades,
  cumulativeGpa,
  gpaOf,
  gradePointOf,
  letterOf,
  scoreRecordOf,
  totalScoreOf,
  transcript,
} from '../../services/grades.js';
import { earnedCredits } from '../../services/enrollment.js';
import { termLabel } from '../../services/schedule.js';
import { badge, card, csrfInput, field, selectField, stat, table, type Tone } from '../components.js';

function letterTone(total: number): Tone {
  if (total >= 80) return 'ok';
  if (total >= 60) return 'warn';
  return 'err';
}

export interface TranscriptOptions {
  db: Database;
  student: Student;
  currentTerm: Term;
  csrfToken: string;
}

/** 學生成績單頁。 */
export function transcriptPage(options: TranscriptOptions): string {
  const { db, student, currentTerm } = options;
  const rows = transcript(db, student.id);
  const published = rows.filter((row) => row.record.published);
  const term = gpaOf(db, student.id, currentTerm);
  const cumulative = cumulativeGpa(db, student.id);
  const credits = earnedCredits(db, student.id);

  const overview = `<div class="grid cols-4">
    ${stat('本學期 GPA', term.gpa.toFixed(2), `${term.credits} 學分`)}
    ${stat('累計 GPA', cumulative.gpa.toFixed(2), `${cumulative.credits} 學分`)}
    ${stat('已登錄學分', `${credits} 學分`, `${rows.length} 門課程有成績`)}
    ${stat('已公布', `${published.length} / ${rows.length}`, '老師公布後方可查閱')}
  </div>`;

  const termRows = rows.map((row) => ({
    ...row,
    termLabelText: termLabel(row.course.term),
    visible: row.record.published || row.course.term !== currentTerm,
  }));

  const list = table(
    [
      { header: '學期', render: (row) => `${escapeHtml(row.course.term)}` },
      { header: '課程', render: (row) => `<b>${escapeHtml(row.course.code)}</b>　${escapeHtml(row.course.name)}` },
      { header: '學分', align: 'num', render: (row) => String(row.course.credits) },
      { header: '學期', render: (row) => escapeHtml(row.termLabelText) },
      {
        header: '總分',
        align: 'num',
        render: (row) =>
          row.visible ? `<b>${escapeHtml(formatScore(row.total))}</b>` : `<span class="badge muted">尚未公布</span>`,
      },
      {
        header: '等第',
        render: (row) => (row.visible ? badge(row.letter, letterTone(row.total)) : ''),
      },
      {
        header: '績分',
        align: 'num',
        render: (row) => (row.visible ? gradePointOf(row.letter).toFixed(1) : ''),
      },
      {
        header: '明細',
        render: (row) =>
          row.visible
            ? row.record.items.map((item) => `${escapeHtml(item.name)} ${formatScore(item.score)}`).join('　')
            : '',
      },
      { header: '更新時間', render: (row) => escapeHtml(formatDate(row.record.updatedAt)) },
    ],
    termRows,
    { empty: '目前沒有任何成績紀錄。' },
  );

  return [
    overview,
    card('歷年成績單', `${list}<p class="note" style="margin-top:14px">等第換算：A ≥ 90、B ≥ 80、C ≥ 70、D ≥ 60、F &lt; 60；GPA 為學分加權平均。</p>`),
  ].join('');
}

export interface GradebookOptions {
  db: Database;
  course: Course;
  rows: ReturnType<typeof classGrades>;
  csrfToken: string;
}

/** 教師的成績管理頁。 */
export function gradebookPage(options: GradebookOptions): string {
  const { db, course, rows, csrfToken } = options;
  const graded = rows.filter((row) => row.record !== undefined);
  const published = rows.filter((row) => row.record?.published === true);
  const average = graded.length === 0 ? 0 : graded.reduce((acc, row) => acc + row.total, 0) / graded.length;
  const pass = graded.filter((row) => row.total >= 60).length;
  const waiting = db.enrollments.filter((row) => row.courseId === course.id && row.status === 'waitlisted').length;

  const overview = `<div class="grid cols-4">
    ${stat('修課學生', `${rows.length} 人`, `候補 ${waiting} 人`)}
    ${stat('已輸入成績', `${graded.length} / ${rows.length}`, graded.length === rows.length ? '全部完成' : `尚缺 ${rows.length - graded.length} 人`)}
    ${stat('已公布', `${published.length} 人`, '公布後學生即可查閱')}
    ${stat('平均分數', graded.length === 0 ? '—' : formatScore(average), `及格 ${pass} 人 / ${graded.length} 人`)}
  </div>`;

  const list = table(
    [
      { header: '學號', render: (row) => escapeHtml(row.student.studentId) },
      { header: '姓名', render: (row) => escapeHtml(row.student.name) },
      { header: '班級', render: (row) => escapeHtml(row.student.className) },
      {
        header: '各項成績',
        render: (row) =>
          row.record === undefined
            ? '<span class="badge muted">尚未輸入</span>'
            : row.record.items.map((item) => `${escapeHtml(item.name)} <b>${escapeHtml(formatScore(item.score))}</b>（${escapeHtml(String(item.weight))}%）`).join('<br>'),
      },
      {
        header: '總分',
        align: 'num',
        render: (row) => (row.record === undefined ? '—' : `<b>${escapeHtml(formatScore(row.total))}</b>`),
      },
      { header: '等第', render: (row) => (row.letter === '' ? '' : badge(row.letter, letterTone(row.total))) },
      {
        header: '公布',
        render: (row) => {
          if (row.record === undefined) return '';
          return `<form method="post" action="/grades/${escapeHtml(row.record.id)}/publish" style="margin:0">
            ${csrfInput(csrfToken)}
            <input type="hidden" name="published" value="${row.record.published ? '0' : '1'}">
            <input type="hidden" name="courseId" value="${escapeHtml(course.id)}">
            <button class="btn small ${row.record.published ? 'danger' : 'ghost'}" type="submit">${row.record.published ? '取消公布' : '公布'}</button>
          </form>`;
        },
      },
      {
        header: '',
        render: (row) => `<a class="btn small ghost" href="/grades/course/${escapeHtml(course.id)}/student/${escapeHtml(row.student.id)}">編輯</a>`,
      },
    ],
    rows,
    { empty: '尚未有學生選修本課' },
  );

  const waitlist = db.enrollments
    .filter((row) => row.courseId === course.id && row.status === 'waitlisted')
    .map((row) => db.users.find((user) => user.id === row.studentId))
    .filter((user): user is Student => user !== undefined && user.role === 'student');

  const waitTable = table(
    [
      { header: '學號', render: (row) => escapeHtml(row.studentId) },
      { header: '姓名', render: (row) => escapeHtml(row.name) },
    ],
    waitlist,
    { empty: '沒有候補名單' },
  );

  return [overview, card(`《${course.code} ${course.name}》成績管理`, list), card('候補名單', waitTable)].join('');
}

export interface ScoreEditorOptions {
  course: Course;
  student: Student;
  record: ScoreRecord | undefined;
  error: string | null;
  csrfToken: string;
  scores: Record<string, string>;
  weights: Record<string, string>;
}

/** 單一學生的成績輸入表單。 */
export function scoreEditorPage(options: ScoreEditorOptions): string {
  const { course, student, record, error, csrfToken } = options;
  const items: ScoreItem[] = record?.items ?? [];
  const names = items.length === 0 ? ['平時成績', '期中考試'] : items.map((item) => item.name);

  const fields = names
    .map((name, index) => {
      const score = options.scores[name] ?? (items[index] === undefined ? '' : String(items[index].score));
      const weight = options.weights[name] ?? (items[index] === undefined ? '' : String(items[index].weight));
      return `<tr>
        <td><input type="text" name="name_${index}" value="${escapeHtml(name)}" required style="min-width:120px"></td>
        <td><input type="number" name="score_${index}" value="${escapeHtml(score)}" min="0" max="100" step="0.5" style="width:100px"></td>
        <td><input type="number" name="weight_${index}" value="${escapeHtml(weight)}" min="1" max="100" step="1" style="width:100px"></td>
      </tr>`;
    })
    .join('');

  const total = record === undefined ? 0 : totalScoreOf(record);
  const letter = record === undefined ? '' : letterOf(total);

  const alert = error === null ? '' : `<div class="alert alert-error" role="alert"><b>!</b> ${escapeHtml(error)}</div>`;

  return `<div class="card">
  <h2>${escapeHtml(course.code)}　${escapeHtml(course.name)} — 輸入 ${escapeHtml(student.name)}（${escapeHtml(student.studentId)}）的成績</h2>
  ${alert}
  <form method="post" action="/grades/course/${escapeHtml(course.id)}/student/${escapeHtml(student.id)}">
    ${csrfInput(csrfToken)}
    <div class="table-wrap"><table>
      <thead><tr><th>評分名稱</th><th>分數（0–100）</th><th>權重（%）</th></tr></thead>
      <tbody>${fields}</tbody>
    </table></div>
    <div class="actions" style="margin-top:14px">
      <button class="btn" type="submit">儲存成績</button>
      <a class="btn ghost" href="/grades/course/${escapeHtml(course.id)}">返回名單</a>
      ${record === undefined ? '' : `<span class="badge ${letterTone(total)}">目前總分 ${escapeHtml(formatScore(total))}（${escapeHtml(letter)}）</span>`}
    </div>
    <p class="note" style="margin-top:14px">總分會依權重自動加權計算，權重總和不必等於 100；成績儲存後不會自動公開，請再按名單上的「公布」鈕。</p>
  </form>
</div>`;
}

export interface AdminGradesOptions {
  db: Database;
  terms: Term[];
  term: Term;
  keyword: string;
}

/** 管理員的成績總覽（依學號查詢學生成績）。 */
export function adminGradesPage(options: AdminGradesOptions): string {
  const { db, term, keyword } = options;
  const key = keyword.trim().toLowerCase();
  const termCourses = db.courses.filter((course) => course.term === term);

  const students = db.users.filter((user): user is Student => {
    if (user.role !== 'student') return false;
    if (key === '') return true;
    return user.name.toLowerCase().includes(key) || user.studentId.toLowerCase().includes(key);
  });

  const rows = students.map((student) => {
    const items = termCourses.map((course) => {
      const record = scoreRecordOf(db, student.id, course.id);
      const total = record === undefined ? null : totalScoreOf(record);
      return {
        code: course.code,
        name: course.name,
        credits: course.credits,
        total,
        letter: total === null ? '' : letterOf(total),
        published: record?.published === true,
      };
    });
    const credits = items.reduce((acc, item) => acc + item.credits, 0);
    const points = items.reduce((acc, item) => acc + (item.letter === '' ? 0 : gradePointOf(item.letter) * item.credits), 0);
    return { student, items, gpa: credits === 0 ? 0 : points / credits };
  });

  const list = table(
    [
      { header: '學號', render: (row) => escapeHtml(row.student.studentId) },
      { header: '姓名', render: (row) => escapeHtml(row.student.name) },
      { header: '班級', render: (row) => escapeHtml(row.student.className) },
      {
        header: '本學期各科成績',
        render: (row) =>
          row.items
            .map((item) =>
              item.total === null
                ? `${escapeHtml(item.code)}　—`
                : `${escapeHtml(item.code)}　<b>${escapeHtml(formatScore(item.total))}</b>${item.published ? '' : ' <span class="badge muted">未公布</span>'}`,
            )
            .join('<br>'),
      },
      { header: 'GPA', align: 'num', render: (row) => row.gpa.toFixed(2) },
    ],
    rows,
    { empty: '查無符合條件的學生' },
  );

  const filters = `<form class="filters" method="get" action="/admin/grades">
    ${selectField('學期', 'term', options.terms.map((item) => ({ value: item, label: `${item}　${termLabel(item)}` })), term, { 'data-autosubmit': 'true' })}
    ${field({ label: '學號或姓名', name: 'q', value: keyword, type: 'search' })}
    <button class="btn" type="submit">查詢</button>
  </form>`;

  return card(`成績查詢（${term}）`, `${filters}${list}`);
}