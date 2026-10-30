import { notFound } from '../core/errors.js';
import type { Router } from '../core/router.js';
import { CLIENT_SCRIPT, STYLESHEET } from '../assets.js';
import { findById, needUser } from '../services/accounts.js';
import { bookmarksOf, commentsOf, isBookmarked, recordRead } from '../services/engagement.js';
import { activePromotion, recordClick, recordImpressions } from '../services/promotion.js';
import { newestWorks, promotionPicks, tipTotal, trendingWorks } from '../services/ranking.js';
import { allTags, canViewWork, chaptersOf, filterWorks, needChapter, needWork, type WorkSort } from '../services/works.js';
import { explorePage, homePage } from '../views/pages/home.js';
import { readerPage, creatorPage, libraryPage, workDetailPage } from '../views/pages/works.js';
import type { Work } from '../types.js';
import { nowISO, page } from './shared.js';

const SORTS: WorkSort[] = ['recommend', 'trending', 'newest', 'tips'];

function parseSort(value: string | null): WorkSort {
  return SORTS.includes(value as WorkSort) ? (value as WorkSort) : 'recommend';
}

export function registerPublic(router: Router): void {
  router.get('/assets/app.css', (ctx) => ctx.asset(STYLESHEET, 'text/css'));
  router.get('/assets/app.js', (ctx) => ctx.asset(CLIENT_SCRIPT, 'application/javascript'));
  router.get('/health', (ctx) => ctx.json({ ok: true, service: 'inkflow' }));

  router.get('/', (ctx) => {
    const db = ctx.services.store.data;
    const now = Date.now();
    const publicWorks = db.works.filter((work) => work.published);
    const promoted = promotionPicks(db, publicWorks, now, 4);
    const activePromotions = promoted
      .map((work) => activePromotion(db, work.id, now))
      .filter((promotion) => promotion !== undefined);
    if (activePromotions.length > 0) {
      ctx.services.store.mutate(() => recordImpressions(db, activePromotions));
    }

    const stats = {
      works: publicWorks.length,
      creators: new Set(publicWorks.map((work) => work.creatorId)).size,
      chapters: db.chapters.filter((chapter) => {
        const work = db.works.find((item) => item.id === chapter.workId);
        return work?.published === true;
      }).length,
      readers: db.users.filter((user) => user.role === 'member').length,
      paidOut: db.withdrawals.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
    };

    page(
      ctx,
      '探索故事',
      homePage({
        db,
        user: ctx.user,
        promoted,
        trending: trendingWorks(db, publicWorks, 4),
        newest: newestWorks(publicWorks, 4),
        stats,
      }),
      '小說、漫畫與正在連載的每一個世界。',
    );
  });

  router.get('/works', (ctx) => {
    const db = ctx.services.store.data;
    const now = Date.now();
    const publicWorks = db.works.filter((work) => work.published);
    const filters = {
      q: ctx.query.get('q') ?? '',
      type: ctx.query.get('type') ?? '',
      tag: ctx.query.get('tag') ?? '',
      status: ctx.query.get('status') ?? '',
      sort: parseSort(ctx.query.get('sort')),
    };
    const works = filterWorks(db, publicWorks, filters, now);
    const promotedIds = new Set(
      publicWorks.filter((work) => activePromotion(db, work.id, now) !== undefined).map((work) => work.id),
    );

    page(
      ctx,
      '所有作品',
      explorePage({ db, user: ctx.user, works, tags: allTags(db), promotedIds, filters, total: works.length }),
      '用小說的文字或漫畫的分鏡，找到下一個想追的故事。',
    );
  });

  router.get('/works/:id', (ctx) => {
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    if (!canViewWork(work, ctx.user)) throw notFound('找不到這部作品');
    if (ctx.query.get('ref') === 'promo') {
      ctx.services.store.mutate(() => recordClick(db, work.id));
    }

    const creator = findById(db, work.creatorId);
    const comments = commentsOf(db, work.id);
    page(
      ctx,
      work.title,
      workDetailPage({
        db,
        work,
        creator,
        user: ctx.user,
        chapters: chaptersOf(db, work.id),
        comments,
        bookmarked: isBookmarked(db, work.id, ctx.user?.id),
        bookmarks: db.bookmarks.filter((bookmark) => bookmark.workId === work.id).length,
        tipTotal: tipTotal(db, work.id),
        promotion: activePromotion(db, work.id),
        canManage: ctx.user !== undefined && (ctx.user.id === work.creatorId || ctx.user.role === 'admin'),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      `${creator?.name ?? '未知作者'} · ${work.synopsis.slice(0, 40)}`,
    );
  });

  router.get('/works/:id/chapters/:chapterId', (ctx) => {
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    if (!canViewWork(work, ctx.user)) throw notFound('找不到這部作品');
    const chapter = needChapter(db, work.id, ctx.params['chapterId'] ?? '');
    const reward = ctx.services.store.mutate(() => recordRead(db, work, chapter, ctx.user, nowISO()));
    const creator = findById(db, work.creatorId);

    page(
      ctx,
      `${work.title}・${chapter.title}`,
      readerPage({
        db,
        work,
        creator,
        chapter,
        chapters: chaptersOf(db, work.id),
        user: ctx.user,
        csrfToken: ctx.session?.csrf ?? '',
        canManage: ctx.user !== undefined && (ctx.user.id === work.creatorId || ctx.user.role === 'admin'),
        reward,
      }),
      undefined,
      'reading-body',
      true,
    );
  });

  router.get('/creators/:id', (ctx) => {
    const db = ctx.services.store.data;
    const creator = needUser(db, ctx.params['id'] ?? '');
    const isSelf = ctx.user?.id === creator.id;
    const works = db.works.filter(
      (work) => work.creatorId === creator.id && (work.published || isSelf || ctx.user?.role === 'admin'),
    );
    const now = Date.now();
    const promotedIds = new Set(
      works.filter((work) => activePromotion(db, work.id, now) !== undefined).map((work) => work.id),
    );

    page(
      ctx,
      creator.name,
      creatorPage({
        db,
        creator,
        works,
        totalViews: works.reduce((sum, work) => sum + work.views, 0),
        totalTips: db.tips.filter((tip) => tip.creatorId === creator.id).reduce((sum, tip) => sum + tip.amount, 0),
        isSelf,
        promotedIds,
      }),
      creator.bio === '' ? '創作者頁面' : creator.bio,
    );
  });

  router.get('/library', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const now = Date.now();
    const works = bookmarksOf(db, user.id)
      .map((bookmark) => db.works.find((work) => work.id === bookmark.workId))
      .filter((work): work is Work => work !== undefined && canViewWork(work, user));
    const promotedIds = new Set(
      works.filter((work) => activePromotion(db, work.id, now) !== undefined).map((work) => work.id),
    );
    page(ctx, '我的收藏', libraryPage({ db, works, promotedIds }), `共 ${works.length} 部收藏作品。`);
  }, ['member', 'admin']);
}

