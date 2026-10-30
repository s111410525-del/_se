import { badRequest, forbidden, notFound } from '../core/errors.js';
import { newId } from '../util/id.js';
import type { Chapter, ChapterInput, Database, User, Work, WorkInput } from '../types.js';
import { scoreOfWork } from './ranking.js';

export function findWork(db: Database, id: string): Work | undefined {
  return db.works.find((work) => work.id === id);
}

export function needWork(db: Database, id: string): Work {
  const work = findWork(db, id);
  if (work === undefined) throw notFound('找不到這部作品');
  return work;
}

export function canManageWork(work: Work, user: User | undefined): boolean {
  return user !== undefined && (user.id === work.creatorId || user.role === 'admin');
}

export function canViewWork(work: Work, user: User | undefined): boolean {
  return work.published || canManageWork(work, user);
}

export function assertCanManage(work: Work, user: User | undefined): void {
  if (!canManageWork(work, user)) throw forbidden('只有作者本人或平台管理員可以管理這部作品');
}

/** 公開作品；管理員與作者另外可看到未公開草稿。 */
export function visibleWorks(db: Database, user: User | undefined): Work[] {
  return db.works.filter((work) => canViewWork(work, user));
}

export function chaptersOf(db: Database, workId: string): Chapter[] {
  return db.chapters.filter((chapter) => chapter.workId === workId).sort((a, b) => a.order - b.order);
}

export function needChapter(db: Database, workId: string, chapterId: string): Chapter {
  const chapter = db.chapters.find((item) => item.id === chapterId && item.workId === workId);
  if (chapter === undefined) throw notFound('找不到這個章節');
  return chapter;
}

export function chapterCount(db: Database, workId: string): number {
  return db.chapters.filter((chapter) => chapter.workId === workId).length;
}

export function wordCountOf(db: Database, workId: string): number {
  return db.chapters
    .filter((chapter) => chapter.workId === workId)
    .reduce((sum, chapter) => sum + chapter.content.replace(/\s/gu, '').length, 0);
}

export function createWork(db: Database, creator: User, input: WorkInput, now: string): Work {
  const work: Work = {
    id: newId('wrk'),
    creatorId: creator.id,
    title: input.title,
    synopsis: input.synopsis,
    type: input.type,
    tags: input.tags,
    cover: input.cover,
    status: input.status,
    published: input.published,
    featured: false,
    createdAt: now,
    updatedAt: now,
    views: 0,
  };
  db.works.push(work);
  return work;
}

export function updateWork(work: Work, input: WorkInput, now: string): void {
  work.title = input.title;
  work.synopsis = input.synopsis;
  work.type = input.type;
  work.tags = input.tags;
  work.cover = input.cover;
  work.status = input.status;
  work.published = input.published;
  work.updatedAt = now;
}

export function createChapter(db: Database, work: Work, input: ChapterInput, now: string): Chapter {
  const order = chaptersOf(db, work.id).reduce((max, chapter) => Math.max(max, chapter.order), 0) + 1;
  const chapter: Chapter = {
    id: newId('chp'),
    workId: work.id,
    title: input.title,
    content: input.content,
    imageUrls: input.imageUrls,
    order,
    views: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.chapters.push(chapter);
  work.updatedAt = now;
  return chapter;
}

export function updateChapter(work: Work, chapter: Chapter, input: ChapterInput, now: string): void {
  if (chapter.workId !== work.id) throw badRequest('章節不屬於這部作品');
  chapter.title = input.title;
  chapter.content = input.content;
  chapter.imageUrls = input.imageUrls;
  chapter.updatedAt = now;
  work.updatedAt = now;
}

export function deleteChapter(db: Database, work: Work, chapterId: string, now: string): Chapter {
  const index = db.chapters.findIndex((chapter) => chapter.id === chapterId && chapter.workId === work.id);
  if (index < 0) throw notFound('找不到這個章節');
  const [removed] = db.chapters.splice(index, 1);
  if (removed === undefined) throw notFound('找不到這個章節');

  chaptersOf(db, work.id).forEach((chapter, order) => {
    chapter.order = order + 1;
  });
  work.updatedAt = now;
  return removed;
}

export function setPublished(work: Work, published: boolean, now: string): void {
  work.published = published;
  work.updatedAt = now;
}

export function setFeatured(work: Work, featured: boolean): void {
  work.featured = featured;
}

export type WorkSort = 'recommend' | 'trending' | 'newest' | 'tips';

export interface WorkFilter {
  q?: string;
  type?: string;
  tag?: string;
  status?: string;
  sort?: WorkSort;
}

function tipTotalOf(db: Database, workId: string): number {
  return db.tips.filter((tip) => tip.workId === workId).reduce((sum, tip) => sum + tip.amount, 0);
}

/** 依查詢條件篩選與排序作品。 */
export function filterWorks(db: Database, list: Work[], filter: WorkFilter, now: number = Date.now()): Work[] {
  const keyword = (filter.q ?? '').trim().toLowerCase();
  const tag = (filter.tag ?? '').trim();
  const type = (filter.type ?? '').trim();
  const status = (filter.status ?? '').trim();

  const filtered = list.filter((work) => {
    if (type !== '' && work.type !== type) return false;
    if (status !== '' && work.status !== status) return false;
    if (tag !== '' && !work.tags.includes(tag)) return false;
    if (keyword !== '') {
      const creator = db.users.find((user) => user.id === work.creatorId);
      const haystack = [work.title, work.synopsis, work.tags.join(' '), creator?.name ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  const sort = filter.sort ?? 'recommend';
  return filtered.sort((a, b) => {
    if (sort === 'newest') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (sort === 'trending') return b.views - a.views;
    if (sort === 'tips') return tipTotalOf(db, b.id) - tipTotalOf(db, a.id);
    return scoreOfWork(db, b, now) - scoreOfWork(db, a, now);
  });
}

export function allTags(db: Database): string[] {
  const tags = new Set<string>();
  for (const work of db.works) {
    if (!work.published) continue;
    for (const tag of work.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}
