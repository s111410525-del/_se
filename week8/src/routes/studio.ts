import type { Context } from '../core/context.js';
import type { Router } from '../core/router.js';
import { FormValidator, URL_PATTERN, type Errors } from '../core/validate.js';
import { findById } from '../services/accounts.js';
import {
  availableBalance,
  earningsOf,
  pendingWithdrawalOf,
  requestWithdrawal,
  reservedForWithdrawal,
  tipEarned,
  totalEarned,
  viewEarned,
  withdrawalsOf,
} from '../services/earnings.js';
import { activePromotion, ensurePlanPromotion, promotionStatsOf } from '../services/promotion.js';
import {
  assertCanManage,
  chaptersOf,
  createChapter,
  createWork,
  deleteChapter,
  needChapter,
  needWork,
  setPublished,
  updateChapter,
  updateWork,
} from '../services/works.js';
import type { ChapterInput, Work, WorkInput } from '../types.js';
import { REVENUE_RULES, TAG_LIMIT, WORK_STATUSES, WORK_TYPES } from '../types.js';
import { splitTokens } from '../util/html.js';
import { chapterFormPage, earningsPage, studioDashboard, workFormPage, workManagePage } from '../views/pages/studio.js';
import { asUserError, nowISO, page } from './shared.js';

interface ParsedWork {
  values: Record<string, string>;
  errors: Errors;
  input?: WorkInput;
}

function readWorkForm(form: URLSearchParams, existing?: Work): ParsedWork {
  const v = new FormValidator(form);
  const title = v.text('title', { label: '作品名稱', required: true, maxLength: 60 });
  const synopsis = v.text('synopsis', { label: '作品簡介', required: true, maxLength: 500 });
  const type = v.choice('type', { label: '類型', required: true }, WORK_TYPES);
  const status = v.choice('status', { label: '連載狀態', required: true }, WORK_STATUSES);
  const cover = v.text('cover', { label: '封面符號', maxLength: 8 });
  const tagsRaw = v.text('tags', { label: '標籤', maxLength: 100 });
  const tags = splitTokens(tagsRaw);
  const published = form.get('published') === '1';

  const errors: Errors = { ...v.errors };
  if (tags.length > TAG_LIMIT) errors['tags'] = `標籤最多 ${TAG_LIMIT} 個`;

  const values: Record<string, string> = {
    title,
    synopsis,
    type: type === '' ? existing?.type ?? 'novel' : type,
    status: status === '' ? existing?.status ?? 'serializing' : status,
    cover,
    tags: tagsRaw,
    published: published ? '1' : '0',
  };

  if (Object.keys(errors).length > 0) return { values, errors };
  return {
    values,
    errors,
    input: {
      title,
      synopsis,
      type: type === '' ? 'novel' : type,
      status: status === '' ? 'serializing' : status,
      cover: cover === '' ? '📖' : cover,
      tags,
      published,
    },
  };
}

interface ParsedChapter {
  values: Record<string, string>;
  errors: Errors;
  input?: ChapterInput;
}

function readChapterForm(form: URLSearchParams): ParsedChapter {
  const v = new FormValidator(form);
  const title = v.text('title', { label: '章節標題', required: true, maxLength: 80 });
  const content = v.text('content', { label: '章節內容', required: true, maxLength: 20000 });
  const rawUrls = form.get('imageUrls') ?? '';
  const imageUrls = rawUrls
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const errors: Errors = { ...v.errors };
  if (imageUrls.length > 30) errors['imageUrls'] = '圖片網址最多 30 個';
  const invalid = imageUrls.find((url) => !URL_PATTERN.test(url));
  if (invalid !== undefined) errors['imageUrls'] = `圖片網址格式不正確：${invalid}`;

  const values: Record<string, string> = { title, content, imageUrls: rawUrls };
  if (Object.keys(errors).length > 0) return { values, errors };
  return { values, errors, input: { title, content, imageUrls } };
}

function renderWorkForm(
  ctx: Context,
  mode: 'create' | 'edit',
  work: Work | undefined,
  values: Record<string, string>,
  errors: Errors,
): void {
  page(
    ctx,
    mode === 'create' ? '發表新作品' : '編輯作品',
    workFormPage({ mode, work, values, errors, csrfToken: ctx.session?.csrf ?? '' }),
    mode === 'create' ? '免費帳號即可投稿，付費帳號還會獲得收益與推流。' : undefined,
  );
}

function renderChapterForm(
  ctx: Context,
  mode: 'create' | 'edit',
  work: Work,
  chapterId: string | undefined,
  values: Record<string, string>,
  errors: Errors,
): void {
  const chapter = chapterId === undefined ? undefined : needChapter(ctx.services.store.data, work.id, chapterId);
  page(
    ctx,
    mode === 'create' ? '新增章節' : '編輯章節',
    chapterFormPage({ mode, work, chapter, values, errors, csrfToken: ctx.session?.csrf ?? '' }),
  );
}

export function registerStudio(router: Router): void {
  const roles: ('member' | 'admin')[] = ['member', 'admin'];

  router.get('/studio', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const works = db.works
      .filter((work) => work.creatorId === user.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const promotion = promotionStatsOf(db, user.id);

    page(
      ctx,
      '創作中心',
      studioDashboard({
        db,
        user,
        works,
        totals: {
          views: works.reduce((sum, work) => sum + work.views, 0),
          earned: totalEarned(db, user.id),
          available: availableBalance(db, user.id),
          reserved: reservedForWithdrawal(db, user.id),
          promotionImpressions: promotion.impressions,
          promotionClicks: promotion.clicks,
        },
        recentEarnings: earningsOf(db, user.id).slice(0, 5),
        pendingWithdrawal: pendingWithdrawalOf(db, user.id),
      }),
      '管理作品、章節、收益與系統推流。',
    );
  }, roles);

  router.get('/studio/works/new', (ctx) => {
    renderWorkForm(ctx, 'create', undefined, {
      title: '',
      type: 'novel',
      status: 'serializing',
      cover: '📖',
      tags: '',
      synopsis: '',
      published: '1',
    }, {});
  }, roles);

  router.post('/studio/works', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const parsed = readWorkForm(form);
    if (parsed.input === undefined) {
      renderWorkForm(ctx, 'create', undefined, parsed.values, parsed.errors);
      return;
    }

    const work = ctx.services.store.mutate((db) => {
      const created = createWork(db, user, parsed.input as WorkInput, nowISO());
      if (created.published && user.plan === 'pro') ensurePlanPromotion(db, created, nowISO());
      return created;
    });
    ctx.flash('success', `作品《${work.title}》已建立。${work.published ? '現在可以新增第一章了。' : '目前是草稿，只有你看得到。'}`);
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.get('/studio/works/:id', (ctx) => {
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    page(
      ctx,
      `管理《${work.title}》`,
      workManagePage({
        db,
        work,
        chapters: chaptersOf(db, work.id),
        tips: db.tips
          .filter((tip) => tip.workId === work.id)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        promotion: activePromotion(db, work.id),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '章節、打賞與推流數據都在這裡。',
    );
  }, roles);

  router.get('/studio/works/:id/edit', (ctx) => {
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    renderWorkForm(ctx, 'edit', work, {
      title: work.title,
      type: work.type,
      status: work.status,
      cover: work.cover,
      tags: work.tags.join('、'),
      synopsis: work.synopsis,
      published: work.published ? '1' : '0',
    }, {});
  }, roles);

  router.post('/studio/works/:id', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    const parsed = readWorkForm(form, work);
    if (parsed.input === undefined) {
      renderWorkForm(ctx, 'edit', work, parsed.values, parsed.errors);
      return;
    }

    ctx.services.store.mutate((target) => {
      const stored = needWork(target, work.id);
      updateWork(stored, parsed.input as WorkInput, nowISO());
      const creator = findById(target, stored.creatorId);
      if (stored.published && creator?.plan === 'pro') ensurePlanPromotion(target, stored, nowISO());
    });
    ctx.flash('success', '作品資料已更新。');
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.post('/studio/works/:id/toggle', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);

    const published = ctx.services.store.mutate((target) => {
      const stored = needWork(target, work.id);
      setPublished(stored, !stored.published, nowISO());
      const creator = findById(target, stored.creatorId);
      if (stored.published && creator?.plan === 'pro') ensurePlanPromotion(target, stored, nowISO());
      return stored.published;
    });
    ctx.flash('success', published ? '作品已公開。' : '作品已取消公開，讀者暫時看不到。');
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.post('/studio/works/:id/promote', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    const creator = findById(db, work.creatorId);
    if (creator?.plan !== 'pro') {
      ctx.flash('error', '只有付費帳號的作品可以啟動系統推流。請先升級方案。');
      ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
      return;
    }
    if (activePromotion(db, work.id) !== undefined) {
      ctx.flash('info', '這部作品已有進行中的推流，等活動結束後再啟動新的一檔。');
      ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
      return;
    }
    ctx.services.store.mutate((target) => {
      const stored = needWork(target, work.id);
      ensurePlanPromotion(target, stored, nowISO());
    });
    ctx.flash('success', `已啟動 ${REVENUE_RULES.promotionDays} 天系統推流。`);
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.get('/studio/works/:id/chapters/new', (ctx) => {
    const work = needWork(ctx.services.store.data, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    renderChapterForm(ctx, 'create', work, undefined, { title: '', content: '', imageUrls: '' }, {});
  }, roles);

  router.post('/studio/works/:id/chapters', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const work = needWork(ctx.services.store.data, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    const parsed = readChapterForm(form);
    if (parsed.input === undefined) {
      renderChapterForm(ctx, 'create', work, undefined, parsed.values, parsed.errors);
      return;
    }

    const chapter = ctx.services.store.mutate((db) => createChapter(db, needWork(db, work.id), parsed.input as ChapterInput, nowISO()));
    ctx.flash('success', `已發布第 ${chapter.order} 章〈${chapter.title}〉。`);
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.get('/studio/works/:id/chapters/:chapterId/edit', (ctx) => {
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    const chapter = needChapter(db, work.id, ctx.params['chapterId'] ?? '');
    renderChapterForm(
      ctx,
      'edit',
      work,
      chapter.id,
      { title: chapter.title, content: chapter.content, imageUrls: chapter.imageUrls.join('\n') },
      {},
    );
  }, roles);

  router.post('/studio/works/:id/chapters/:chapterId', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    const chapter = needChapter(db, work.id, ctx.params['chapterId'] ?? '');
    const parsed = readChapterForm(form);
    if (parsed.input === undefined) {
      renderChapterForm(ctx, 'edit', work, chapter.id, parsed.values, parsed.errors);
      return;
    }

    ctx.services.store.mutate((target) => {
      const storedWork = needWork(target, work.id);
      const storedChapter = needChapter(target, work.id, chapter.id);
      updateChapter(storedWork, storedChapter, parsed.input as ChapterInput, nowISO());
    });
    ctx.flash('success', '章節已更新。');
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.post('/studio/works/:id/chapters/:chapterId/delete', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    assertCanManage(work, ctx.user);
    ctx.services.store.mutate((target) => {
      const storedWork = needWork(target, work.id);
      deleteChapter(target, storedWork, ctx.params['chapterId'] ?? '', nowISO());
    });
    ctx.flash('success', '章節已刪除。');
    ctx.redirect(`/studio/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.get('/studio/earnings', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    page(
      ctx,
      '創作收益',
      earningsPage({
        db,
        user,
        earnings: earningsOf(db, user.id),
        withdrawals: withdrawalsOf(db, user.id),
        totals: {
          earned: totalEarned(db, user.id),
          view: viewEarned(db, user.id),
          tip: tipEarned(db, user.id),
          reserved: reservedForWithdrawal(db, user.id),
          available: availableBalance(db, user.id),
        },
        pending: pendingWithdrawalOf(db, user.id),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '閱讀收益、打賞分潤與提領紀錄。',
    );
  }, roles);

  router.post('/studio/withdraw', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const available = availableBalance(db, user.id);
    const v = new FormValidator(form);
    const amount = v.integer('amount', {
      label: '提領金額',
      required: true,
      min: REVENUE_RULES.withdrawMin,
      max: Math.floor(available),
    }, 0);
    const note = v.text('note', { label: '備註', maxLength: 100 });

    if (!v.ok) {
      ctx.flash('error', v.message());
      ctx.redirect('/studio/earnings');
      return;
    }
    try {
      ctx.services.store.mutate((target) => requestWithdrawal(target, user, amount, note, nowISO()));
      ctx.flash('success', `已送出提領申請 NT$ ${amount.toLocaleString('zh-TW')}，平台審核後會更新狀態。`);
    } catch (err) {
      ctx.flash('error', asUserError(err).message);
    }
    ctx.redirect('/studio/earnings');
  }, roles);
}
