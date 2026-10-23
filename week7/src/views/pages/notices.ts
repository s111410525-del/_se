import type { Database, Notice } from '../../types.js';
import { NOTICE_CATEGORIES } from '../../types.js';
import { escapeHtml, formatDateTime } from '../../util/html.js';
import { teacherName } from '../../services/accounts.js';
import { badge, card, csrfInput, field, selectField, table, textareaField, checkboxField } from '../components.js';

export interface NoticeListOptions {
  db: Database;
  category: string;
  keyword: string;
  canManage: boolean;
  csrfToken: string;
}

/** 公告列表頁（含管理者的新增表單）。 */
export function noticeListPage(options: NoticeListOptions): string {
  const { db } = options;
  const keyword = options.keyword.trim();
  const notices = db.notices
    .filter((notice) => {
      if (options.category !== '' && notice.category !== options.category) return false;
      if (keyword !== '' && !`${notice.title} ${notice.body}`.toLowerCase().includes(keyword.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt));

  const filters = `<form class="filters" method="get" action="/notices">
    ${selectField('類別', 'category', [{ value: '', label: '全部' }, ...NOTICE_CATEGORIES.map((c) => ({ value: c, label: c }))], options.category, { 'data-autosubmit': 'true' })}
    ${field({ label: '關鍵字', name: 'q', value: options.keyword, type: 'search', placeholder: '標題或內文' })}
    <button class="btn" type="submit">查詢</button>
    <a class="btn ghost" href="/notices">清除</a>
  </form>`;

  const list = table(
    [
      { header: '標題', render: (row) => `<a href="/notices/${escapeHtml(row.id)}"><b>${escapeHtml(row.title)}</b></a>${row.pinned ? ` ${badge('置頂', 'warn')}` : ''}` },
      { header: '類別', render: (row) => badge(row.category, row.category === '選課' ? 'info' : row.category === '繳費' ? 'warn' : 'muted') },
      { header: '發布者', render: (row) => escapeHtml(teacherName(db, row.authorId, '系統')) },
      { header: '時間', render: (row) => escapeHtml(formatDateTime(row.publishedAt)) },
      {
        header: '',
        render: (row) =>
          options.canManage
            ? `<div class="actions">
                <form method="post" action="/admin/notices/${escapeHtml(row.id)}/pin" style="margin:0">${csrfInput(options.csrfToken)}<button class="btn small ghost" type="submit">${row.pinned ? '取消置頂' : '置頂'}</button></form>
                <form method="post" action="/admin/notices/${escapeHtml(row.id)}/delete" style="margin:0" data-confirm="確定要刪除這則公告嗎？">${csrfInput(options.csrfToken)}<button class="btn small danger" type="submit">刪除</button></form>
              </div>`
            : '',
      },
    ],
    notices,
    { empty: '查無符合條件的公告。' },
  );

  const create = options.canManage
    ? card(
        '新增公告',
        `<form class="stack" method="post" action="/admin/notices" style="max-width:none">
          ${csrfInput(options.csrfToken)}
          ${field({ label: '標題', name: 'title', required: true })}
          ${selectField('類別', 'category', NOTICE_CATEGORIES.map((c) => ({ value: c, label: c })), '公告')}
          ${textareaField('內文', 'body', '', '支援換行，最多 4000 字')}
          ${checkboxField('設為置頂公告', 'pinned')}
          <div class="actions"><button class="btn" type="submit">發布公告</button></div>
        </form>`,
      )
    : '';

  return [card(`校園公告（${notices.length} 則）`, `${filters}${list}`), create].filter((block) => block !== '').join('');
}

/** 公告詳情頁。 */
export function noticeDetailPage(options: { db: Database; notice: Notice }): string {
  const { db, notice } = options;
  const paragraphs = notice.body
    .split(/\n{2,}/u)
    .map((block) => `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/gu, '<br>')}</p>`)
    .join('');

  return `<div class="card">
  <p style="margin:0 0 6px"><a href="/notices">← 返回公告列表</a></p>
  <h2 style="font-size:19px;margin:0 0 6px">${escapeHtml(notice.title)}</h2>
  <p style="margin:0 0 14px;color:#667081;font-size:13px">
    ${badge(notice.category, 'muted')}
    發布者：${escapeHtml(teacherName(db, notice.authorId, '系統'))}　
    ${escapeHtml(formatDateTime(notice.publishedAt))}
  </p>
  <div style="border-top:1px solid #d8dee7;padding-top:14px">${paragraphs}</div>
</div>`;
}