import type { Database, Student, User } from '../../types.js';
import { escapeHtml } from '../../util/html.js';
import { advisorOf } from '../../services/accounts.js';
import { earnedCredits, registeredCredits } from '../../services/enrollment.js';
import { cumulativeGpa } from '../../services/grades.js';
import { balanceOf, billOf } from '../../services/fees.js';
import { badge, card, descriptionList, field, stat, textareaField } from '../components.js';

export interface ProfileOptions {
  db: Database;
  user: User;
  currentTerm: string;
  csrfToken: string;
  errors: Record<string, string>;
  form: Record<string, string>;
}

/** 個人資料頁（同一頁同時負責顯示與編輯）。 */
export function profilePage(options: ProfileOptions): string {
  const { db, user, form, errors, csrfToken } = options;
  const value = (name: string, fallback: string): string => form[name] ?? fallback;
  const alert = Object.keys(errors).length === 0
    ? ''
    : `<div class="alert alert-error" role="alert"><b>!</b> ${escapeHtml(Object.values(errors).join('；'))}</div>`;

  const account = card(
    '帳號資料',
    descriptionList([
      ['登入帳號', `<code>${escapeHtml(user.username)}</code>`],
      ['角色', badge(user.role === 'student' ? '學生' : user.role === 'teacher' ? '教師' : '教職員', 'brand')],
      [
        '基本資料',
        user.role === 'student'
          ? `學號 ${escapeHtml(user.studentId)}　${escapeHtml(user.department)} ${escapeHtml(user.className)}　${user.gradeYear} 年級`
          : user.role === 'teacher'
            ? `${escapeHtml(user.title)}　${escapeHtml(user.department)}　${escapeHtml(user.office)}`
            : `${escapeHtml(user.title)}　工號 ${escapeHtml(user.employeeId)}`,
      ],
      ['帳號建立時間', escapeHtml(user.createdAt.slice(0, 10))],
    ]),
  );

  if (user.role === 'student') {
    const student = user as Student;
    const advisor = advisorOf(db, student);
    const bill = billOf(db, student.id, options.currentTerm);
    const summary = `<div class="grid cols-4">
      ${stat('本學期學分', `${registeredCredits(db, student.id, options.currentTerm)} 學分`, options.currentTerm)}
      ${stat('累計已登錄學分', `${earnedCredits(db, student.id)} 學分`, '')}
      ${stat('累計 GPA', cumulativeGpa(db, student.id).gpa.toFixed(2), '')}
      ${stat('待繳費用', bill === undefined ? '—' : `NT$ ${balanceOf(bill).toLocaleString('zh-TW')}`, bill === undefined ? '' : `期限 ${bill.dueDate}`, bill === undefined ? 'muted' : balanceOf(bill) === 0 ? 'ok' : 'warn')}
    </div>`;

    const advisorCard = card(
      '導師資訊',
      advisor === undefined
        ? '<p class="empty">尚未指派導師。</p>'
        : descriptionList([
            ['姓名', `${escapeHtml(advisor.name)}　${escapeHtml(advisor.email)}`],
            ['職稱', user.role === 'student' && advisor.role === 'teacher' ? escapeHtml(advisor.title) : '—'],
            ['辦公室', advisor.role === 'teacher' ? escapeHtml(advisor.office) : '—'],
          ]),
    );

    const edit = card(
      '編輯個人資料',
      `${alert}<form class="stack" method="post" action="/profile" style="max-width:none">
        ${field({ label: '姓名', name: 'name', value: value('name', user.name), required: true })}
        ${field({ label: '電子郵件', name: 'email', type: 'email', value: value('email', user.email), required: true })}
        ${field({ label: '聯絡電話', name: 'phone', value: value('phone', student.phone), hint: '例：0900-123-456' })}
        ${textareaField('通訊地址', 'address', value('address', student.address))}
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <div class="actions"><button class="btn" type="submit">儲存變更</button></div>
        <p class="note">學號、系所、年級與角色屬學校註冊資料，需至註冊課務組辦理更改。</p>
      </form>`,
    );

    return [summary, `<div class="grid cols-2">${account}${advisorCard}</div>`, edit].join('');
  }

  const edit = card(
    '編輯個人資料',
    `${alert}<form class="stack" method="post" action="/profile" style="max-width:none">
      ${field({ label: '姓名', name: 'name', value: value('name', user.name), required: true })}
      ${field({ label: '電子郵件', name: 'email', type: 'email', value: value('email', user.email), required: true })}
      <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
      <div class="actions"><button class="btn" type="submit">儲存變更</button></div>
    </form>`,
  );

  return [`<div class="grid cols-2">${account}</div>`, edit].join('');
}