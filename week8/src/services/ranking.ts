import type { Database, Work } from '../types.js';
import { activePromotion } from './promotion.js';

const DAY = 24 * 60 * 60 * 1000;

function tipTotalOf(db: Database, workId: string): number {
  return db.tips.filter((tip) => tip.workId === workId).reduce((sum, tip) => sum + tip.amount, 0);
}

function commentCountOf(db: Database, workId: string): number {
  return db.comments.filter((comment) => comment.workId === workId).length;
}

function bookmarkCountOf(db: Database, workId: string): number {
  return db.bookmarks.filter((bookmark) => bookmark.workId === workId).length;
}

/**
 * 作品推薦分數。
 *
 * 瀏覽、打賞與留言都用 log 壓縮，避免一部爆紅作品永遠占滿版面；
 * 進行中的系統推流與管理員精選則給予明顯加權，這是平台「推流」的實際效果。
 */
export function scoreOfWork(db: Database, work: Work, now: number = Date.now()): number {
  const tips = tipTotalOf(db, work.id);
  const comments = commentCountOf(db, work.id);
  const engagement = Math.log10(1 + work.views) * 12 + Math.log10(1 + tips) * 10 + Math.log10(1 + comments) * 5;
  const promotion = activePromotion(db, work.id, now) === undefined ? 0 : 18;
  const featured = work.featured ? 25 : 0;
  const ageDays = Math.max(0, (now - Date.parse(work.createdAt)) / DAY);
  const freshness = Math.max(0, 12 - ageDays / 10);
  return engagement + promotion + featured + freshness;
}

export function recommendedWorks(db: Database, works: Work[], now: number = Date.now(), limit = 8): Work[] {
  return [...works]
    .sort((a, b) => scoreOfWork(db, b, now) - scoreOfWork(db, a, now))
    .slice(0, limit);
}

/** 熱門排行：以實際閱讀為主，留言、收藏與打賞為輔。 */
export function trendingWorks(db: Database, works: Work[], limit = 8): Work[] {
  return [...works]
    .sort((a, b) => {
      const score = (work: Work): number =>
        work.views + commentCountOf(db, work.id) * 80 + bookmarkCountOf(db, work.id) * 40 + tipTotalOf(db, work.id) * 2;
      return score(b) - score(a);
    })
    .slice(0, limit);
}

export function newestWorks(works: Work[], limit = 8): Work[] {
  return [...works].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, limit);
}

/** 首頁推流區：先取有進行中推流的作品，再用推薦分數排序。 */
export function promotionPicks(db: Database, works: Work[], now: number = Date.now(), limit = 4): Work[] {
  const promoted = works.filter((work) => activePromotion(db, work.id, now) !== undefined);
  return recommendedWorks(db, promoted, now, limit);
}

export function tipTotal(db: Database, workId: string): number {
  return tipTotalOf(db, workId);
}

export function interactionCount(db: Database, workId: string): number {
  return commentCountOf(db, workId) + bookmarkCountOf(db, workId);
}
