import type { Database, User, Work } from '../types.js';
import { PLAN_LABELS, WORK_STATUS_LABELS, WORK_TYPE_LABELS } from '../types.js';
import { findById } from '../services/accounts.js';
import { bookmarkCount } from '../services/engagement.js';
import { tipTotal } from '../services/ranking.js';
import { chapterCount } from '../services/works.js';
import { colorIndex, escapeHtml, formatNumber, truncate } from '../util/html.js';

export function workHref(work: Work): string {
  return `/works/${encodeURIComponent(work.id)}`;
}

export function creatorOf(db: Database, work: Work): User | undefined {
  return findById(db, work.creatorId);
}

export function creatorLink(db: Database, work: Work): string {
  const creator = creatorOf(db, work);
  if (creator === undefined) return '<span class="muted">未知創作者</span>';
  return `<a href="/creators/${encodeURIComponent(creator.id)}">${escapeHtml(creator.name)}</a>`;
}

export function planBadge(user: User | undefined): string {
  if (user === undefined) return '';
  return user.plan === 'pro'
    ? `<span class="badge pro">PRO</span>`
    : `<span class="badge muted">${PLAN_LABELS.free}</span>`;
}

export function statusBadge(work: Work): string {
  return work.status === 'completed'
    ? `<span class="badge info">${WORK_STATUS_LABELS.completed}</span>`
    : `<span class="badge ok">${WORK_STATUS_LABELS.serializing}</span>`;
}

export function typeBadge(work: Work): string {
  return `<span class="badge ${work.type === 'novel' ? '' : 'warn'}">${WORK_TYPE_LABELS[work.type]}</span>`;
}

export interface WorkCardOptions {
  promoted?: boolean;
  showCreator?: boolean;
  compact?: boolean;
}

/** 作品卡片；首頁、探索頁、創作者頁與收藏頁共用。 */
export function workCard(db: Database, work: Work, options: WorkCardOptions = {}): string {
  const creator = creatorOf(db, work);
  const promoted = options.promoted === true ? '<span class="badge pro">推流中</span>' : '';
  const featured = work.featured ? '<span class="badge gold">編輯精選</span>' : '';
  const draft = work.published ? '' : '<span class="badge err">未公開</span>';
  const meta = options.showCreator === false
    ? ''
    : `<span class="creator-dot">${escapeHtml(creator?.avatar ?? '🪶')}</span> ${creatorLink(db, work)} ${planBadge(creator)}`;

  return `<article class="work-card${options.compact === true ? ' compact' : ''}">
  <a class="cover color-${colorIndex(work.id)}" href="${workHref(work)}" aria-label="${escapeHtml(work.title)}">
    <span class="cover-emoji" aria-hidden="true">${escapeHtml(work.cover)}</span>
    <span class="cover-kind">${WORK_TYPE_LABELS[work.type]}</span>
  </a>
  <div class="work-card-body">
    <div class="badge-row">${statusBadge(work)}${typeBadge(work)}${featured}${promoted}${draft}</div>
    <h3><a href="${workHref(work)}">${escapeHtml(work.title)}</a></h3>
    <p class="synopsis">${escapeHtml(truncate(work.synopsis, options.compact === true ? 60 : 90))}</p>
    <div class="work-meta">${meta}</div>
    <div class="work-stats">
      <span>👁 ${formatNumber(work.views)}</span>
      <span>📖 ${chapterCount(db, work.id)} 章</span>
      <span>💛 ${formatNumber(tipTotal(db, work.id))}</span>
      <span>🔖 ${formatNumber(bookmarkCount(db, work.id))}</span>
    </div>
  </div>
</article>`;
}

export function tagList(tags: string[]): string {
  if (tags.length === 0) return '';
  return `<div class="tag-list">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`;
}

export function statCard(label: string, value: string, hint = '', tone = ''): string {
  return `<div class="stat ${tone}">
  <div class="label">${escapeHtml(label)}</div>
  <div class="value">${escapeHtml(value)}</div>
  ${hint === '' ? '' : `<div class="hint">${escapeHtml(hint)}</div>`}
</div>`;
}

export function sectionHeader(title: string, subtitle = '', href?: string, linkLabel = '查看全部'): string {
  const link = href === undefined ? '' : `<a class="section-link" href="${href}">${escapeHtml(linkLabel)} →</a>`;
  return `<div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle === '' ? '' : `<p>${escapeHtml(subtitle)}</p>`}</div>${link}</div>`;
}

export function emptyState(message: string, action?: { href: string; label: string }): string {
  const link = action === undefined ? '' : `<a class="btn ghost small" href="${action.href}">${escapeHtml(action.label)}</a>`;
  return `<div class="empty">${escapeHtml(message)}${link === '' ? '' : `<div style="margin-top:12px">${link}</div>`}</div>`;
}

export function workLinks(db: Database, works: Work[], promotedIds: Set<string> = new Set()): string {
  if (works.length === 0) return emptyState('目前還沒有符合條件的作品。');
  return `<div class="work-grid">${works
    .map((work) => workCard(db, work, { promoted: promotedIds.has(work.id) }))
    .join('')}</div>`;
}
