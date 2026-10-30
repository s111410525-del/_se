import { escapeHtml } from '../../util/html.js';
import type { Errors } from '../../core/validate.js';

export interface LoginPageOptions {
  error: string | null;
  username: string;
  csrfToken: string;
  next: string;
  demoAccounts: { username: string; role: string }[];
}

export function loginPage(options: LoginPageOptions): string {
  const error = options.error === null ? '' : `<div class="alert alert-error" role="alert">${escapeHtml(options.error)}</div>`;
  const demos = options.demoAccounts
    .map(
      (account) =>
        `<div class="demo-account"><span><b>${escapeHtml(account.username)}</b>　${escapeHtml(account.role)}</span><span class="muted">ink1234</span></div>`,
    )
    .join('');

  return `<div class="auth-wrap"><div class="auth-card">
  <section class="auth-hero">
    <a class="brand" href="/" style="font-size:20px">墨流<span>InkFlow</span></a>
    <h1>讓故事被看見，<br>也讓創作被支持。</h1>
    <p>免費帳號就能投稿小說與漫畫。升級付費帳號後，你的作品會依閱讀數與讀者打賞產生收益，並自動進入系統推流。</p>
    <ul>
      <li>小說與漫畫連載空間</li>
      <li>閱讀收益 90% 打賞分潤</li>
      <li>付費作品自動系統推流</li>
    </ul>
  </section>
  <section class="auth-form">
    <h2>登入墨流</h2>
    <p class="lead">繼續閱讀、留言，或回到你的創作中心。</p>
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
      <div class="inline-note" style="margin-bottom:6px">示範帳號（密碼皆為 ink1234）</div>
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

  const field = (name: string, label: string, type: string, options2: { hint?: string; autocomplete?: string; maxlength?: number } = {}): string => {
    const error = options.errors[name] === undefined ? '' : `<span class="error">${escapeHtml(options.errors[name])}</span>`;
    const hint = options2.hint === undefined ? '' : `<span class="hint">${escapeHtml(options2.hint)}</span>`;
    return `<div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <input id="${name}" type="${type}" name="${name}" value="${escapeHtml(options.values[name] ?? '')}" maxlength="${options2.maxlength ?? 80}" autocomplete="${options2.autocomplete ?? 'off'}" required>
      ${hint}${error}
    </div>`;
  };

  return `<div class="auth-wrap"><div class="auth-card">
  <section class="auth-hero">
    <a class="brand" href="/" style="font-size:20px">墨流<span>InkFlow</span></a>
    <h1>建立你的<br>創作空間。</h1>
    <p>註冊後就是免費帳號，可以立即上傳作品、建立章節、經營讀者。想開通收益與推流時，再升級付費帳號即可。</p>
    <ul>
      <li>免費：無限投稿、章節管理、讀者留言</li>
      <li>付費：閱讀收益、打賞分潤、系統推流</li>
      <li>隨時可升級或降級，不收隱藏費用</li>
    </ul>
  </section>
  <section class="auth-form">
    <h2>免費註冊</h2>
    <p class="lead">填寫基本資料就能開始連載。</p>
    ${summary}
    <form method="post" action="/register" class="stack" style="max-width:none">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      ${field('username', '帳號', 'text', { hint: '3～24 個英文字母、數字或底線，登入時使用', autocomplete: 'username', maxlength: 24 })}
      ${field('name', '筆名', 'text', { hint: '會顯示在作品與留言旁', autocomplete: 'nickname', maxlength: 20 })}
      ${field('email', '電子郵件', 'email', { autocomplete: 'email', maxlength: 60 })}
      ${field('password', '密碼', 'password', { hint: '至少 8 個字', autocomplete: 'new-password', maxlength: 200 })}
      ${field('confirmPassword', '確認密碼', 'password', { autocomplete: 'new-password', maxlength: 200 })}
      <div class="field">
        <label class="check-line"><input type="checkbox" name="agree" value="1" required> 我了解這是課程示範平台，收益與付款皆為模擬</label>
      </div>
      <button class="btn block" type="submit">建立免費帳號</button>
    </form>
    <p class="auth-switch">已經有帳號了？<a href="/login">回到登入</a></p>
  </section>
</div></div>`;
}
