import { badRequest, notFound } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Database, Notice } from '../types.js';
import { NOTICE_CATEGORIES } from '../types.js';

export interface NoticeInput {
  title: string;
  category: Notice['category'];
  body: string;
  pinned: boolean;
}

/** 驗證公告內容。 */
export function validateNotice(input: NoticeInput): NoticeInput {
  const errors: string[] = [];
  if (input.title === '') errors.push('標題不得為空');
  if (input.title.length > 60) errors.push('標題不得超過 60 個字');
  if (input.body.length > 4000) errors.push('內文不得超過 4000 個字');
  if (!NOTICE_CATEGORIES.includes(input.category)) errors.push('公告類別不合法');
  if (errors.length > 0) throw badRequest(errors.join('；'));
  return input;
}

/** 依類別與關鍵字查詢公告，置頂者永遠排在最前面。 */
export function listNotices(db: Database, options: { category?: string; keyword?: string } = {}): Notice[] {
  const keyword = (options.keyword ?? '').trim().toLowerCase();
  return db.notices
    .filter((notice) => {
      if (options.category !== undefined && options.category !== '' && notice.category !== options.category) return false;
      if (keyword !== '') {
        const haystack = `${notice.title} ${notice.body}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt));
}

/** 依 id 查公告。 */
export function findNotice(db: Database, id: string): Notice | undefined {
  return db.notices.find((notice) => notice.id === id);
}

/** 依 id 查公告，找不到時拋出 404。 */
export function needNotice(db: Database, id: string): Notice {
  const notice = findNotice(db, id);
  if (notice === undefined) throw notFound('找不到這則公告');
  return notice;
}

/** 新增公告。 */
export function createNotice(db: Database, authorId: string, input: NoticeInput, now: Date = new Date()): Notice {
  const checked = validateNotice(input);
  const notice: Notice = {
    id: newId('not'),
    title: checked.title,
    category: checked.category,
    body: checked.body,
    authorId,
    pinned: checked.pinned,
    publishedAt: now.toISOString(),
  };
  db.notices.unshift(notice);
  return notice;
}

/** 切換置頂狀態。 */
export function togglePin(db: Database, id: string): Notice {
  const notice = needNotice(db, id);
  notice.pinned = !notice.pinned;
  return notice;
}

/** 刪除公告。 */
export function removeNotice(db: Database, id: string): void {
  const index = db.notices.findIndex((notice) => notice.id === id);
  if (index < 0) throw notFound('找不到這則公告');
  db.notices.splice(index, 1);
}

/** 最新置頂公告，顯示在學生首頁。 */
export function pinnedNotices(db: Database, limit = 3): Notice[] {
  return db.notices.filter((notice) => notice.pinned).slice(0, limit);
}