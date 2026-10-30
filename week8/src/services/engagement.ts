import { badRequest } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Bookmark, Chapter, Comment, Database, User, Work } from '../types.js';
import { rewardRead } from './earnings.js';

/** 記錄一次章節閱讀，並在符合條件時寫入創作者收益。 */
export function recordRead(
  db: Database,
  work: Work,
  chapter: Chapter,
  reader: User | undefined,
  nowISO: string,
): number {
  work.views += 1;
  chapter.views += 1;
  return rewardRead(db, work, chapter.title, reader, nowISO);
}

export function commentsOf(db: Database, workId: string): Comment[] {
  return db.comments
    .filter((comment) => comment.workId === workId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function addComment(db: Database, work: Work, user: User, body: string, nowISO: string): Comment {
  const text = body.trim();
  if (text === '') throw badRequest('留言內容不能空白');
  if (text.length > 500) throw badRequest('留言不可超過 500 個字');

  const comment: Comment = {
    id: newId('cmt'),
    workId: work.id,
    userId: user.id,
    body: text,
    createdAt: nowISO,
  };
  db.comments.push(comment);
  return comment;
}

export function removeComment(db: Database, commentId: string, user: User): void {
  const index = db.comments.findIndex((comment) => comment.id === commentId);
  if (index < 0) return;
  const comment = db.comments[index];
  if (comment === undefined) return;
  if (comment.userId !== user.id && user.role !== 'admin') throw badRequest('只能刪除自己的留言');
  db.comments.splice(index, 1);
}

export function isBookmarked(db: Database, workId: string, userId: string | undefined): boolean {
  if (userId === undefined) return false;
  return db.bookmarks.some((bookmark) => bookmark.workId === workId && bookmark.userId === userId);
}

export function bookmarkCount(db: Database, workId: string): number {
  return db.bookmarks.filter((bookmark) => bookmark.workId === workId).length;
}

/** 切換收藏，回傳切換後是否已收藏。 */
export function toggleBookmark(db: Database, workId: string, userId: string, nowISO: string): boolean {
  const index = db.bookmarks.findIndex((bookmark) => bookmark.workId === workId && bookmark.userId === userId);
  if (index >= 0) {
    db.bookmarks.splice(index, 1);
    return false;
  }
  const bookmark: Bookmark = { userId, workId, createdAt: nowISO };
  db.bookmarks.push(bookmark);
  return true;
}

export function bookmarksOf(db: Database, userId: string): Bookmark[] {
  return db.bookmarks
    .filter((bookmark) => bookmark.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
