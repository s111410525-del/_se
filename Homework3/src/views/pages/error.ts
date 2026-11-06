import type { User } from '../../types.js';
import { escapeHtml } from '../../util/html.js';
import { layout } from '../layout.js';

export interface ErrorPageOptions {
  status: number;
  title: string;
  message: string;
  detail: string | null;
  user: User | undefined;
  csrfToken: string;
}

export function errorPage(options: ErrorPageOptions): string {
  return layout({
    title: options.title,
    path: '/',
    user: options.user,
    csrfToken: options.csrfToken,
    flash: [],
    body: `<section class="card" style="max-width:640px;margin:40px auto;text-align:center">
      <div style="font-family:var(--serif);font-size:64px;line-height:1;color:var(--teal);margin-bottom:8px">${options.status}</div>
      <h1 style="margin:0 0 8px;font-size:26px">${escapeHtml(options.title)}</h1>
      <p style="color:var(--muted)">${escapeHtml(options.message)}</p>
      ${options.detail === null ? '' : `<p class="inline-note">${escapeHtml(options.detail)}</p>`}
      <div class="actions" style="justify-content:center;margin-top:18px">
        <a class="btn" href="/">回到探索頁</a>
        <a class="btn ghost" href="/jobs">找工作</a>
      </div>
    </section>`,
  });
}
