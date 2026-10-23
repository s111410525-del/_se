import { escapeHtml } from '../../util/html.js';
import { csrfInput, field } from '../components.js';
import { demoAccounts } from '../../db/seed.js';

export interface LoginViewOptions {
  error: string | null;
  username: string;
  csrfToken: string;
  next: string;
}

/** 登入頁面。 */
export function loginPage(options: LoginViewOptions): string {
  const error = options.error === null ? '' : `<div class="alert alert-error" role="alert"><b>!</b> ${escapeHtml(options.error)}</div>`;
  const accounts = demoAccounts()
    .map(
      (account) =>
        `<div class="demo-account"><code>${escapeHtml(account.username)}</code><span style="color:#667081">${escapeHtml(account.role)}</span></div>`,
    )
    .join('');

  return `<div class="login-page">
<div class="login-card">
  <section class="login-hero">
    <h1>金門大學校務系統</h1>
    <p>National Quemoy University　Campus Information System</p>
    <ul>
      <li>選課、課表與學分查詢</li>
      <li>成績單與 GPA 計算</li>
      <li>學雜費繳費與收據紀錄</li>
      <li>校園公告與選課資訊</li>
    </ul>
    <p style="margin-top:22px;font-size:12px;opacity:.75">本系統為課程作業示範，所有資料皆為虛構，請勿輸入真實個資。</p>
  </section>
  <section class="login-form">
    <h2 style="margin:0 0 4px;font-size:18px">登入校園入口</h2>
    <p style="margin:0 0 16px;color:#667081;font-size:13px">請使用校號或教職員工號登入。</p>
    ${error}
    <form class="stack" method="post" action="/login">
      ${csrfInput(options.csrfToken)}
      ${field({ label: '帳號', name: 'username', value: options.username, required: true, placeholder: '例如 s001' })}
      ${field({ label: '密碼', name: 'password', type: 'password', required: true, placeholder: '請輸入密碼' })}
      <input type="hidden" name="next" value="${escapeHtml(options.next)}">
      <button class="btn" type="submit">登入</button>
    </form>
    <div class="note" style="margin-top:18px">
      <b>示範帳號</b>（密碼皆為 <code>nqu1234</code>）
      <div style="margin-top:6px">${accounts}</div>
    </div>
  </section>
</div>
</div>`;
}