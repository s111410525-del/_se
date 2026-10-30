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
  const detail = options.detail === null ? '' : `<p class="muted">${escapeHtml(options.detail)}</p>`;
  return layout({
    title: options.title,
    path: '__error__',
    user: options.user,
    csrfToken: options.csrfToken,
    flash: [],
    body: `<div class="card" style="max-width:640px;margin:40px auto;text-align:center">
      <div style="font-family:var(--serif);font-size:64px;line-height:1;color:var(--gold)">${options.status}</div>
      <h2 style="justify-content:center;margin-top:16px">${escapeHtml(options.message)}</h2>
      ${detail}
      <div class="actions" style="justify-content:center;margin-top:20px">
        <a class="btn" href="/">回到探索</a>
        <a class="btn ghost" href="/works">瀏覽作品</a>
      </div>
    </div>`,
  });
}
