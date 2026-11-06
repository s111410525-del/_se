import { notFound } from '../core/errors.js';
import type { Router } from '../core/router.js';
import { CLIENT_SCRIPT, STYLESHEET } from '../assets.js';
import { needUser } from '../services/accounts.js';
import {
  canViewJob,
  categoryCounts,
  filterJobs,
  needJob,
  parseCategory,
  parseEmploymentType,
  parseJobSort,
  publishedJobs,
  recordJobView,
} from '../services/jobs.js';
import { findConversation } from '../services/messaging.js';
import {
  activePromotion,
  activePromotionMap,
  recordImpression,
} from '../services/promotion.js';
import type { Job } from '../types.js';
import { companyPage, homePage, jobDetailPage, jobsPage } from '../views/pages/home.js';
import { page } from './shared.js';

function newestFirst(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function registerPublic(router: Router): void {
  router.get('/assets/app.css', (ctx) => ctx.asset(STYLESHEET, 'text/css'));
  router.get('/assets/app.js', (ctx) => ctx.asset(CLIENT_SCRIPT, 'application/javascript'));
  router.get('/health', (ctx) => ctx.json({ ok: true, service: 'jobbeam' }));

  router.get('/', (ctx) => {
    const db = ctx.services.store.data;
    const publicJobs = publishedJobs(db);
    const promotedMap = activePromotionMap(db, publicJobs.map((job) => job.id));
    const promoted = newestFirst(publicJobs.filter((job) => promotedMap.has(job.id))).slice(0, 3);
    const newest = newestFirst(publicJobs).slice(0, 6);
    const stats = {
      jobs: publicJobs.length,
      employers: db.users.filter((user) => user.role === 'employer').length,
      seekers: db.users.filter((user) => user.role === 'seeker').length,
      promotions: promotedMap.size,
    };

    page(
      ctx,
      '探索工作',
      homePage({
        db,
        user: ctx.user,
        promoted,
        newest,
        promotedIds: new Set(promotedMap.keys()),
        categories: categoryCounts(db),
        stats,
      }),
      '瀏覽工作內容、要求與預設月薪，找到下一份值得投入的工作。',
    );
  });

  router.get('/jobs', (ctx) => {
    const db = ctx.services.store.data;
    const filters = {
      q: (ctx.query.get('q') ?? '').trim(),
      category: parseCategory(ctx.query.get('category')),
      employmentType: parseEmploymentType(ctx.query.get('employmentType')),
      location: (ctx.query.get('location') ?? '').trim(),
      salaryMin: Math.max(0, Number.parseInt(ctx.query.get('salaryMin') ?? '0', 10) || 0),
      sort: parseJobSort(ctx.query.get('sort')),
    };
    const jobs = filterJobs(db, publishedJobs(db), filters);
    const promotedMap = activePromotionMap(db, jobs.map((job) => job.id));
    const appliedJobIds = new Set(
      ctx.user?.role === 'seeker'
        ? db.conversations.filter((conversation) => conversation.seekerId === ctx.user?.id).map((conversation) => conversation.jobId)
        : [],
    );

    page(
      ctx,
      '找工作',
      jobsPage({
        db,
        user: ctx.user,
        jobs,
        promotedIds: new Set(promotedMap.keys()),
        appliedJobIds,
        categories: categoryCounts(db),
        filters,
        total: jobs.length,
      }),
      '用關鍵字、分類、工作型態與月薪門檻篩選職缺。',
    );
  });

  router.get('/jobs/:id', (ctx) => {
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');
    if (!canViewJob(job, ctx.user)) throw notFound('找不到這個職缺');

    const promotion = activePromotion(db, job.id);
    ctx.services.store.mutate((target) => {
      const stored = needJob(target, job.id);
      recordJobView(stored);
      if (promotion !== undefined) recordImpression(target, stored.id);
    });

    const employer = db.users.find((user) => user.id === job.employerId);
    const conversation = ctx.user?.role === 'seeker'
      ? findConversation(db, job.id, ctx.user.id)
      : undefined;
    const similar = newestFirst(
      publishedJobs(db).filter((item) => item.id !== job.id && item.category === job.category),
    ).slice(0, 3);
    const promotedMap = activePromotionMap(db, similar.map((item) => item.id));

    page(
      ctx,
      job.title,
      jobDetailPage({
        db,
        job,
        employer,
        user: ctx.user,
        promotion,
        conversation,
        similar,
        promotedIds: new Set(promotedMap.keys()),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      `${employer?.company !== undefined && employer.company !== '' ? employer.company : employer?.name ?? '企業'} · ${job.location}`,
    );
  });

  router.get('/companies/:id', (ctx) => {
    const db = ctx.services.store.data;
    const employer = needUser(db, ctx.params['id'] ?? '');
    if (employer.role !== 'employer') throw notFound('找不到這間企業');

    const jobs = publishedJobs(db).filter((job) => job.employerId === employer.id);
    const promotedMap = activePromotionMap(db, jobs.map((job) => job.id));
    page(
      ctx,
      employer.company === '' ? employer.name : employer.company,
      companyPage({ db, employer, jobs, promotedIds: new Set(promotedMap.keys()) }),
      employer.bio === '' ? '企業職缺列表' : employer.bio,
    );
  });
}
