import type { FlashKind, FlashMessage } from '../core/session.js';
import type { Role, User } from '../types.js';
import { ROLE_LABELS } from '../types.js';
import { escapeHtml } from '../util/html.js';
import { CLIENT_SCRIPT, STYLESHEET } from '../assets.js';

type NavRole = Role | 'guest';

interface NavItem {
  href: string;
  label: string;
  roles: NavRole[];
}

const ALL: NavRole[] = ['guest', 'seeker', 'employer', 'admin'];
const AUTH: NavRole[] = ['seeker', 'employer', 'admin'];

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '探索', roles: ALL },
  { href: '/jobs', label: '找工作', roles: ALL },
  { href: '/dashboard', label: '我的應徵', roles: ['seeker'] },
  { href: '/employer', label: '徵才中心', roles: ['employer'] },
  { href: '/messages', label: '訊息', roles: AUTH },
  { href: '/wallet', label: '錢包', roles: ['employer'] },
  { href: '/admin', label: '平台管理', roles: ['admin'] },
  { href: '/profile', label: '帳號', roles: AUTH },
];

function navFor(user: User | undefined): NavItem[] {
  const role: NavRole = user?.role ?? 'guest';
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

function isActive(path: string, href: string): boolean {
  if (path === href) return true;
  if (href === '/' || href === '/employer' || href === '/dashboard' || href === '/admin') return false;
  return path.startsWith(`${href}/`);
}

const FLASH_ICON: Record<FlashKind, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

function flashBlock(messages: FlashMessage[]): string {
  if (messages.length === 0) return '';
  return `<div class="flash-stack">${messages
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
  subtitle?: string;
  head?: string;
  bodyClass?: string;
  hidePageHead?: boolean;
}

function whoBlock(user: User | undefined, csrfToken: string): string {
  if (user === undefined) {
    return `<div class="who guest"><a class="btn small ghost-light" href="/login">登入</a><a class="btn small" href="/register">免費註冊</a></div>`;
  }
  const company = user.company === '' ? '' : `<span class="role-tag">${escapeHtml(user.company)}</span>`;
  return `<div class="who">
      <a class="who-link" href="/profile"><span class="who-avatar">${escapeHtml(user.avatar)}</span><span>${escapeHtml(user.name)}</span></a>
      <span class="role-tag">${ROLE_LABELS[user.role]}</span>
      ${company}
      <form method="post" action="/logout" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <button class="btn small ghost-light" type="submit">登出</button>
      </form>
    </div>`;
}

export function layout(options: LayoutOptions): string {
  const { user } = options;
  const nav = `<nav class="nav">${navFor(user)
    .map((item) => `<a href="${item.href}" class="${isActive(options.path, item.href) ? 'active' : ''}">${item.label}</a>`)
    .join('')}</nav>`;

  const subtitle = options.subtitle === undefined ? '' : `<p>${escapeHtml(options.subtitle)}</p>`;
  const pageHead = options.hidePageHead === true ? '' : `<div class="page-head"><h1>${escapeHtml(options.title)}</h1>${subtitle}</div>`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}｜職光 JobBeam</title>
<meta name="description" content="職光 JobBeam 是找工作與徵才平台：求職者免費註冊後可私訊應徵，企業可刊登職缺並用錢包儲值購買曝光。">
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💼</text></svg>">
${options.head ?? ''}
</head>
<body${options.bodyClass === undefined ? '' : ` class="${escapeHtml(options.bodyClass)}"`}>
<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/">職光<span>JobBeam</span><small>找到下一份值得投入的工作</small></a>
  ${nav}
  ${whoBlock(user, options.csrfToken)}
</div></header>
<main class="shell">
${flashBlock(options.flash)}
${pageHead}
${options.body}
</main>
<footer class="footer">
  <span>職光 JobBeam · 求職與徵才平台</span>
  <span>課程示範專案：職缺、訊息與儲值金額皆為模擬資料。</span>
</footer>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export function authLayout(options: { title: string; body: string; head?: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}｜職光 JobBeam</title>
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💼</text></svg>">
${options.head ?? ''}
</head>
<body class="auth-body">
${options.body}
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export { STYLESHEET, CLIENT_SCRIPT };
