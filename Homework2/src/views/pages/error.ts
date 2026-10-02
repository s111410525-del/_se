import { escapeHtml } from '../../util/html.js';
import { authLayout } from '../layout.js';
import { csrfInput } from '../components.js';

export interface ErrorViewOptions {
  status: number;
  title: string;
  message: string;
  detail: string | null;
  user: { name: string } | undefined;
  csrfToken: string;
}

/** 錯誤頁面。 */
export function errorPage(options: ErrorViewOptions): string {
  const detail = options.detail === null || options.detail === '' ? '' : `<p style="color:#667081;font-size:14px">${escapeHtml(options.detail)}</p>`;
  const body = `<div class="login-page">
<div class="login-card" style="grid-template-columns:1fr">
  <section class="login-form" style="text-align:center;padding:44px 32px">
    <p style="margin:0;font-size:52px;font-weight:800;color:#0b5fa5;line-height:1">${options.status}</p>
    <h1 style="font-size:20px;margin:10px 0 6px">${escapeHtml(options.title)}</h1>
    <p style="color:#384252">${escapeHtml(options.message)}</p>
    ${detail}
    <div class="actions" style="justify-content:center;margin-top:22px">
      <a class="btn" href="/">回到首頁</a>
      <form method="post" action="/logout" style="margin:0">
        ${csrfInput(options.csrfToken)}
        <button class="btn ghost" type="submit">登出</button>
      </form>
    </div>
  </section>
</div>
</div>`;
  return authLayout({ title: options.title, body });
}