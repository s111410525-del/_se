import type { Conversation, Database, Job, Message, User } from '../types.js';
import {
  CONVERSATION_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  JOB_CATEGORY_EMOJI,
  JOB_CATEGORY_LABELS,
} from '../types.js';
import { findById } from '../services/accounts.js';
import { lastMessageOf, unreadCount } from '../services/messaging.js';
import {
  colorIndex,
  escapeHtml,
  formatSalary,
  timeAgo,
  truncate,
} from '../util/html.js';

export function jobHref(job: Job): string {
  return `/jobs/${encodeURIComponent(job.id)}`;
}

export function employerOf(db: Database, job: Job): User | undefined {
  return findById(db, job.employerId);
}

export function employerName(db: Database, job: Job): string {
  const employer = employerOf(db, job);
  return employer?.company !== undefined && employer.company !== '' ? employer.company : (employer?.name ?? '未知企業');
}

export function employerLink(db: Database, job: Job): string {
  const employer = employerOf(db, job);
  if (employer === undefined) return '<span class="muted">未知企業</span>';
  const label = employer.company === '' ? employer.name : employer.company;
  return `<a href="/companies/${encodeURIComponent(employer.id)}">${escapeHtml(label)}</a>`;
}

export function categoryBadge(job: Job): string {
  return `<span class="badge">${JOB_CATEGORY_LABELS[job.category]}</span>`;
}

export function typeBadge(job: Job): string {
  return `<span class="badge muted">${EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>`;
}

export function promotionBadge(): string {
  return '<span class="badge promo">曝光中</span>';
}

export function conversationStatusBadge(conversation: Conversation): string {
  const tone = conversation.status === 'invited'
    ? 'ok'
    : conversation.status === 'closed'
      ? 'muted'
      : conversation.status === 'reviewing'
        ? 'warn'
        : 'info';
  return `<span class="badge ${tone}">${CONVERSATION_STATUS_LABELS[conversation.status]}</span>`;
}

export interface JobCardOptions {
  promoted?: boolean;
  applied?: boolean;
  showCompany?: boolean;
}

/** 職缺卡片；首頁、搜尋頁、企業頁共用。 */
export function jobCard(db: Database, job: Job, options: JobCardOptions = {}): string {
  const promoted = options.promoted === true ? promotionBadge() : '';
  const applied = options.applied === true ? '<span class="badge ok">已應徵</span>' : '';
  const company = options.showCompany === false
    ? ''
    : `<div class="company-line">🏢 ${employerLink(db, job)}</div>`;
  const requirements = truncate(job.requirements.replace(/\s+/gu, ' ').trim(), 64);

  return `<article class="job-card">
  <div class="job-card-top color-${colorIndex(job.id)}">
    <span class="job-emoji" aria-hidden="true">${JOB_CATEGORY_EMOJI[job.category]}</span>
    ${promoted}
  </div>
  <div class="job-card-body">
    <div class="badge-row">${categoryBadge(job)}${typeBadge(job)}${applied}</div>
    <h3><a href="${jobHref(job)}">${escapeHtml(job.title)}</a></h3>
    ${company}
    <p class="salary">${escapeHtml(formatSalary(job.salaryMin, job.salaryMax, job.salaryNote))}</p>
    <p class="job-req">需求：${escapeHtml(requirements)}</p>
    <div class="job-meta"><span>📍 ${escapeHtml(job.location)}</span></div>
    ${tagList(job.tags)}
    <div class="job-card-foot">
      <span>${escapeHtml(timeAgo(job.updatedAt))}更新</span>
      <span>👁 ${job.views.toLocaleString('zh-TW')}</span>
    </div>
  </div>
</article>`;
}

export function jobGrid(db: Database, jobs: Job[], promotedIds: Set<string> = new Set(), appliedJobIds: Set<string> = new Set()): string {
  if (jobs.length === 0) return emptyState('目前沒有符合條件的職缺，試試放寬搜尋條件。');
  return `<div class="job-grid">${jobs
    .map((job) => jobCard(db, job, { promoted: promotedIds.has(job.id), applied: appliedJobIds.has(job.id) }))
    .join('')}</div>`;
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

export interface ConversationCardOptions {
  viewer: User;
  unread: number;
}

/** 私訊對話摘要；求職者看到企業，企業看到求職者。 */
export function conversationCard(
  db: Database,
  conversation: Conversation,
  options: ConversationCardOptions,
): string {
  const job = db.jobs.find((item) => item.id === conversation.jobId);
  const isSeeker = options.viewer.id === conversation.seekerId;
  const otherId = isSeeker ? conversation.employerId : conversation.seekerId;
  const other = db.users.find((user) => user.id === otherId);
  const displayName = other === undefined
    ? '未知使用者'
    : isSeeker && other.company !== ''
      ? other.company
      : other.name;
  const subtitle = isSeeker
    ? (other?.name ?? '')
    : `應徵 ${job?.title ?? '職缺'}`;
  const preview = previewMessage(lastMessageOf(db, conversation));
  const unreadBadge = options.unread > 0 ? `<span class="unread-dot">${options.unread}</span>` : '';

  return `<a class="conversation-card" href="/messages/${encodeURIComponent(conversation.id)}" style="text-decoration:none;color:inherit">
    <span class="conversation-avatar">${escapeHtml(other?.avatar ?? '💬')}</span>
    <span class="conversation-main">
      <h3>${escapeHtml(displayName)} ${conversationStatusBadge(conversation)}</h3>
      <div class="inline-note">${escapeHtml(subtitle)}</div>
      <div class="conversation-preview">${escapeHtml(preview)}</div>
    </span>
    <span class="conversation-side">
      <span>${escapeHtml(timeAgo(conversation.updatedAt))}</span>
      ${unreadBadge}
      <span class="badge muted">${escapeHtml(job?.title ?? '職缺已移除')}</span>
    </span>
  </a>`;
}

function previewMessage(message: Message | undefined): string {
  if (message === undefined) return '還沒有訊息';
  return truncate(message.body.replace(/\s+/gu, ' '), 70);
}

export function conversationList(
  db: Database,
  conversations: Conversation[],
  viewer: User,
): string {
  if (conversations.length === 0) {
    return emptyState('目前還沒有任何應徵對話。');
  }
  return `<div class="conversation-list">${conversations
    .map((conversation) => conversationCard(db, conversation, {
      viewer,
      unread: unreadCount(db, conversation, viewer.id),
    }))
    .join('')}</div>`;
}
