import type { FlashMessage, FlashKind } from '../core/session.js';
import type { Role, User } from '../types.js';
import { ROLE_LABELS } from '../types.js';
import { escapeHtml } from '../util/html.js';
import { CLIENT_SCRIPT, STYLESHEET } from '../assets.js';

/** 登入後顯示的功能選單，依角色分開。 */
export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首頁', roles: ['student', 'teacher', 'admin'] },
  { href: '/profile', label: '個人資料', roles: ['student', 'teacher', 'admin'] },
  { href: '/courses', label: '課程查詢', roles: ['student', 'teacher', 'admin'] },
  { href: '/enrollment', label: '選課', roles: ['student'] },
  { href: '/schedule', label: '課表', roles: ['student', 'teacher'] },
  { href: '/grades', label: '成績', roles: ['student', 'teacher', 'admin'] },
  { href: '/fees', label: '繳費', roles: ['student', 'admin'] },
  { href: '/notices', label: '公告', roles: ['student', 'teacher', 'admin'] },
  { href: '/admin', label: '系統管理', roles: ['admin'] },
];

/** 依登入者角色挑出可見的選單。 */
export function navFor(user: User): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
}

const FLASH_ICON: Record<FlashKind, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

function flashBlock(messages: FlashMessage[]): string {
  if (messages.length === 0) return '';
  return `<div class="stack" style="display:grid;gap:8px">${messages
    .map(
      (message) =>
        `<div class="alert alert-${message.kind}" role="alert"><b>${FLASH_ICON[message.kind]}</b> ${escapeHtml(message.text)}</div>`,
    )
    .join('')}</div>`;
}

export interface LayoutOptions {
  title: string;
  path: string;
  user: User | undefined;
  csrfToken: string;
  flash: FlashMessage[];
  body: string;
  /** 頁面副標題。 */
  subtitle?: string;
  /** 額外的 head 內容。 */
  head?: string;
  /** 額外的 body 屬性。 */
  bodyClass?: string;
}

/** 完整 HTML 版面：頂端導覽列 + 內容 + 頁尾。 */
export function layout(options: LayoutOptions): string {
  const { user } = options;
  const nav = user === undefined ? '' : `<nav class="nav">${navFor(user)
    .map((item) => {
      const active = options.path === item.href || (item.href !== '/' && options.path.startsWith(item.href)) ? ' active' : '';
      return `<a href="${escapeHtml(item.href)}" class="${active.trim()}">${escapeHtml(item.label)}</a>`;
    })
    .join('')}</nav>`;

  const who = user === undefined ? '' : `<div class="who">
    <span class="role-tag">${escapeHtml(ROLE_LABELS[user.role])}</span>
    <span>${escapeHtml(user.name)}</span>
    <form method="post" action="/logout" style="margin:0">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      <button class="btn small ghost" type="submit" style="background:transparent;border-color:rgba(255,255,255,.5);color:#fff">登出</button>
    </form>
  </div>`;

  const subtitle = options.subtitle === undefined ? '' : `<p>${escapeHtml(options.subtitle)}</p>`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}｜金門大學校務系統</title>
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:,">
${options.head ?? ''}
</head>
<body${options.bodyClass === undefined ? '' : ` class="${escapeHtml(options.bodyClass)}"`}>
<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/">金門大學校務系統<small>National Quemoy University · Campus Information System</small></a>
  ${nav}
  ${who}
</div></header>
<main class="shell">
${flashBlock(options.flash)}
<div class="page-head"><h1>${escapeHtml(options.title)}</h1>${subtitle}</div>
${options.body}
</main>
<footer class="footer">金門大學 資訊工程系　課程作業示範系統　所有資料皆為虛構</footer>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

/** 登入頁使用的獨立版面。 */
export function authLayout(options: { title: string; body: string; head?: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}｜金門大學校務系統</title>
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:,">
${options.head ?? ''}
</head>
<body>
${options.body}
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export { STYLESHEET, CLIENT_SCRIPT };