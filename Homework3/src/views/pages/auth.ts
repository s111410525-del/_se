import type { Errors } from '../../core/validate.js';
import { escapeHtml } from '../../util/html.js';

export interface LoginPageOptions {
  error: string | null;
  username: string;
  csrfToken: string;
  next: string;
  demoAccounts: { username: string; role: string; note: string }[];
}

export function loginPage(options: LoginPageOptions): string {
  const error = options.error === null ? '' : `<div class="alert alert-error" role="alert">${escapeHtml(options.error)}</div>`;
  const demos = options.demoAccounts
    .map(
      (account) =>
        `<div class="demo-account"><span><b>${escapeHtml(account.username)}</b>　${escapeHtml(account.role)}</span><span class="note">${escapeHtml(account.note)}</span></div>`,
    )
    .join('');

  return `<div class="auth-wrap"><div class="auth-card">
  <section class="auth-hero">
    <a class="brand" href="/" style="font-size:20px">職光<span>JobBeam</span></a>
    <h1>好工作，<br>從一次對話開始。</h1>
    <p>免費註冊就能找到工作、私訊應徵。企業可以刊登職缺，透過儲值購買曝光，讓合適的人更快看見你。</p>
    <ul>
      <li>免費註冊求職帳號，私訊應徵職缺</li>
      <li>企業刊登職缺、管理應徵對話</li>
      <li>錢包儲值後可購買 7／14／30 天曝光</li>
    </ul>
  </section>
  <section class="auth-form">
    <h2>登入職光</h2>
    <p class="lead">回到你的應徵進度、訊息與徵才中心。</p>
    ${error}
    <form method="post" action="/login" class="stack" style="max-width:none">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      <input type="hidden" name="next" value="${escapeHtml(options.next)}">
      <div class="field">
        <label for="username">帳號</label>
        <input id="username" type="text" name="username" value="${escapeHtml(options.username)}" maxlength="24" autocomplete="username" required autofocus>
      </div>
      <div class="field">
        <label for="password">密碼</label>
        <input id="password" type="password" name="password" maxlength="200" autocomplete="current-password" required>
      </div>
      <button class="btn block" type="submit">登入</button>
    </form>
    <p class="auth-switch">還沒有帳號？<a href="/register">建立免費帳號</a></p>
    <div style="margin-top:22px">
      <div class="inline-note" style="margin-bottom:6px">示範帳號（密碼皆為 job1234）</div>
      ${demos}
    </div>
  </section>
</div></div>`;
}

export interface RegisterPageOptions {
  errors: Errors;
  values: Record<string, string>;
  csrfToken: string;
}

export function registerPage(options: RegisterPageOptions): string {
  const summary = Object.keys(options.errors).length === 0
    ? ''
    : `<div class="alert alert-error" role="alert">${escapeHtml(Object.values(options.errors).join('　'))}</div>`;

  const value = (name: string): string => escapeHtml(options.values[name] ?? '');
  const error = (name: string): string => options.errors[name] === undefined
    ? ''
    : `<span class="error">${escapeHtml(options.errors[name])}</span>`;

  const role = options.values['role'] === 'employer' ? 'employer' : 'seeker';
  const isEmployer = role === 'employer';

  const textField = (
    name: string,
    label: string,
    type: string,
    opts: { hint?: string; autocomplete?: string; maxlength?: number; required?: boolean } = {},
  ): string => `<div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <input id="${name}" type="${type}" name="${name}" value="${value(name)}" maxlength="${opts.maxlength ?? 80}" autocomplete="${opts.autocomplete ?? 'off'}"${opts.required === false ? '' : ' required'}>
      ${opts.hint === undefined ? '' : `<span class="hint">${escapeHtml(opts.hint)}</span>`}
      ${error(name)}
    </div>`;

  return `<div class="auth-wrap"><div class="auth-card">
  <section class="auth-hero">
    <a class="brand" href="/" style="font-size:20px">職光<span>JobBeam</span></a>
    <h1>建立帳號，<br>開始找人或找工作。</h1>
    <p>求職者可以免費應徵、私訊企業；企業可以刊登職缺、接收應徵訊息，並用錢包儲值購買曝光。</p>
    <ul>
      <li>求職者：免費註冊、私訊應徵、追蹤進度</li>
      <li>企業：刊登職缺、管理應徵對話</li>
      <li>儲值曝光：7 天 NT$ 299 起</li>
    </ul>
  </section>
  <section class="auth-form">
    <h2>免費註冊</h2>
    <p class="lead">選擇你的身分，填寫基本資料即可開始。</p>
    ${summary}
    <form method="post" action="/register" class="stack" style="max-width:none">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      <div class="field">
        <label>帳號類型</label>
        <div class="radio-row">
          <label class="radio-card">
            <input type="radio" name="role" value="seeker"${isEmployer ? '' : ' checked'}>
            <span><b>我是求職者</b><span>免費應徵職缺、私訊企業</span></span>
          </label>
          <label class="radio-card">
            <input type="radio" name="role" value="employer"${isEmployer ? ' checked' : ''}>
            <span><b>我是企業雇主</b><span>刊登職缺、購買曝光</span></span>
          </label>
        </div>
        ${error('role')}
      </div>
      ${textField('username', '帳號', 'text', { hint: '3～24 個英文字母、數字或底線，登入時使用', autocomplete: 'username', maxlength: 24 })}
      ${textField('name', '姓名／聯絡人', 'text', { hint: '求職者顯示真名或常用名稱；企業填聯絡人', autocomplete: 'name', maxlength: 30 })}
      ${textField('email', '電子郵件', 'email', { autocomplete: 'email', maxlength: 60 })}
      <div class="field" data-role-field="employer"${isEmployer ? '' : ' hidden'}>
        <label for="company">公司名稱</label>
        <input id="company" type="text" name="company" value="${value('company')}" maxlength="40"${isEmployer ? ' required' : ''}>
        <span class="hint">會顯示在職缺與企業頁面</span>
        ${error('company')}
      </div>
      ${textField('password', '密碼', 'password', { hint: '至少 8 個字', autocomplete: 'new-password', maxlength: 200 })}
      ${textField('confirmPassword', '確認密碼', 'password', { autocomplete: 'new-password', maxlength: 200 })}
      <div class="field">
        <label class="check-line"><input type="checkbox" name="agree" value="1" required> 我了解這是課程示範平台，職缺與儲值皆為模擬資料</label>
      </div>
      <button class="btn block" type="submit">建立免費帳號</button>
    </form>
    <p class="auth-switch">已經有帳號了？<a href="/login">回到登入</a></p>
  </section>
</div></div>`;
}
