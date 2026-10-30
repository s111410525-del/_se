import type { FlashKind, FlashMessage } from '../core/session.js';
import type { Role, User } from '../types.js';
import { ROLE_LABELS } from '../types.js';
import { escapeHtml } from '../util/html.js';
import { CLIENT_SCRIPT, STYLESHEET } from '../assets.js';
import { planBadge } from './components.js';

type NavRole = Role | 'guest';

interface NavItem {
  href: string;
  label: string;
  roles: NavRole[];
}

const ALL: NavRole[] = ['guest', 'member', 'admin'];

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '探索', roles: ALL },
  { href: '/works', label: '作品', roles: ALL },
  { href: '/library', label: '收藏', roles: ['member', 'admin'] },
  { href: '/studio', label: '創作中心', roles: ['member', 'admin'] },
  { href: '/studio/earnings', label: '收益', roles: ['member', 'admin'] },
  { href: '/profile', label: '帳號', roles: ['member', 'admin'] },
  { href: '/admin', label: '平台管理', roles: ['admin'] },
];

function navFor(user: User | undefined): NavItem[] {
  const role: NavRole = user?.role ?? 'guest';
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

function isActive(path: string, href: string): boolean {
  if (path === href) return true;
  if (href === '/') return false;
  if (href === '/studio') return false;
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

export function layout(options: LayoutOptions): string {
  const { user } = options;
  const nav = `<nav class="nav">${navFor(user)
    .map((item) => `<a href="${item.href}" class="${isActive(options.path, item.href) ? 'active' : ''}">${item.label}</a>`)
    .join('')}</nav>`;

  const who = user === undefined
    ? `<div class="who guest"><a class="btn small ghost-light" href="/login">登入</a><a class="btn small" href="/register">免費註冊</a></div>`
    : `<div class="who">
      <a class="who-link" href="/profile"><span class="who-avatar">${escapeHtml(user.avatar)}</span><span>${escapeHtml(user.name)}</span>${planBadge(user)}</a>
      <span class="role-tag">${ROLE_LABELS[user.role]}</span>
      <form method="post" action="/logout" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <button class="btn small ghost-light" type="submit">登出</button>
      </form>
    </div>`;

  const subtitle = options.subtitle === undefined ? '' : `<p>${escapeHtml(options.subtitle)}</p>`;
  const pageHead = options.hidePageHead === true ? '' : `<div class="page-head"><h1>${escapeHtml(options.title)}</h1>${subtitle}</div>`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}｜墨流 InkFlow</title>
<meta name="description" content="墨流 InkFlow 是讓創作者連載小說與漫畫的投稿平台，免費帳號可投稿，付費帳號可獲得閱讀收益、讀者打賞與系統推流。">
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🖋</text></svg>">
${options.head ?? ''}
</head>
<body${options.bodyClass === undefined ? '' : ` class="${escapeHtml(options.bodyClass)}"`}>
<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/">墨流<span>InkFlow</span><small>寫下故事的地方</small></a>
  ${nav}
  ${who}
</div></header>
<main class="shell">
${flashBlock(options.flash)}
${pageHead}
${options.body}
</main>
<footer class="footer">
  <span>墨流 InkFlow · 文學作品投稿平台</span>
  <span>所有作品與帳號皆為課程示範資料，金額為模擬數值。</span>
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
<title>${escapeHtml(options.title)}｜墨流 InkFlow</title>
<link rel="stylesheet" href="/assets/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🖋</text></svg>">
${options.head ?? ''}
</head>
<body class="auth-body">
${options.body}
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export { STYLESHEET, CLIENT_SCRIPT };
