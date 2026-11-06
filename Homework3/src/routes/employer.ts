import { notFound } from '../core/errors.js';
import type { Router } from '../core/router.js';
import { FormValidator, type Errors } from '../core/validate.js';
import {
  createJob,
  employerJobs,
  needJob,
  setPublished,
  updateJob,
  type JobFormInput,
} from '../services/jobs.js';
import {
  applicationCountOfJob,
  applicationsOfEmployer,
} from '../services/messaging.js';
import { activePromotionMap, activePromotionsOf } from '../services/promotion.js';
import { needPlan, purchasePromotion } from '../services/wallet.js';
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  JOB_RULES,
  type EmploymentType,
  type JobCategory,
} from '../types.js';
import { splitTokens } from '../util/html.js';
import {
  employerDashboardPage,
  jobFormPage,
  jobToFormValues,
  type JobFormValues,
} from '../views/pages/employer.js';
import { nowISO, page } from './shared.js';

function emptyValues(): JobFormValues {
  return {
    title: '',
    category: 'tech',
    employmentType: 'full-time',
    location: '',
    description: '',
    requirements: '',
    benefits: '',
    tags: '',
    salaryMin: '',
    salaryMax: '',
    salaryNote: '',
    published: '1',
  };
}

interface ParsedJobForm {
  values: JobFormValues;
  errors: Errors;
  input: JobFormInput | null;
}

function parseJobForm(form: URLSearchParams): ParsedJobForm {
  const v = new FormValidator(form);
  const title = v.text('title', { label: '職缺名稱', required: true, maxLength: JOB_RULES.titleMax });
  const category = v.choice('category', { label: '職缺分類', required: true }, JOB_CATEGORIES);
  const employmentType = v.choice('employmentType', { label: '工作型態', required: true }, EMPLOYMENT_TYPES);
  const location = v.text('location', { label: '工作地點', required: true, maxLength: 60 });
  const salaryMin = v.integer('salaryMin', { label: '月薪下限', min: 0, max: JOB_RULES.salaryMax }, 0);
  const salaryMax = v.integer('salaryMax', { label: '月薪上限', min: 0, max: JOB_RULES.salaryMax }, 0);
  const salaryNote = v.text('salaryNote', { label: '薪資補充', maxLength: 80 });
  const tagsText = v.text('tags', { label: '標籤', maxLength: 120 });
  const description = v.text('description', { label: '工作內容', required: true, maxLength: 4000 });
  const requirements = v.text('requirements', { label: '工作要求', required: true, maxLength: 3000 });
  const benefits = v.text('benefits', { label: '福利與環境', maxLength: 1000 });
  const tags = splitTokens(tagsText);
  const errors: Errors = { ...v.errors };

  if (tags.length > JOB_RULES.tagLimit) {
    errors['tags'] = `標籤最多 ${JOB_RULES.tagLimit} 個`;
  }
  if (salaryMin > 0 && salaryMax > 0 && salaryMin > salaryMax) {
    errors['salaryMax'] = '月薪上限不可低於下限';
  }

  const values: JobFormValues = {
    title: form.get('title') ?? '',
    category: form.get('category') ?? '',
    employmentType: form.get('employmentType') ?? '',
    location: form.get('location') ?? '',
    salaryMin: form.get('salaryMin') ?? '',
    salaryMax: form.get('salaryMax') ?? '',
    salaryNote: form.get('salaryNote') ?? '',
    tags: form.get('tags') ?? '',
    description: form.get('description') ?? '',
    requirements: form.get('requirements') ?? '',
    benefits: form.get('benefits') ?? '',
    published: form.get('published') === '1' ? '1' : '',
  };

  const input: JobFormInput | null = Object.keys(errors).length === 0 && category !== '' && employmentType !== ''
    ? {
        title,
        category: category as JobCategory,
        employmentType: employmentType as EmploymentType,
        location,
        description,
        requirements,
        benefits,
        tags,
        salaryMin,
        salaryMax,
        salaryNote,
        published: form.get('published') === '1',
      }
    : null;

  return { values, errors, input };
}

export function registerEmployer(router: Router): void {
  const only: 'employer'[] = ['employer'];

  router.get('/employer', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const jobs = employerJobs(db, user.id);
    const promotedMap = activePromotionMap(db, jobs.map((job) => job.id));
    const applicationCounts = new Map(jobs.map((job) => [job.id, applicationCountOfJob(db, job.id)]));

    page(
      ctx,
      '徵才中心',
      employerDashboardPage({
        db,
        user,
        jobs,
        promotedMap,
        applicationCounts,
        applications: applicationsOfEmployer(db, user.id),
        activePromotions: activePromotionsOf(db, user.id),
        balance: user.balance,
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '管理職缺、查看應徵訊息，並用錢包購買曝光。',
    );
  }, only);

  router.get('/employer/jobs/new', (ctx) => {
    page(
      ctx,
      '刊登新職缺',
      jobFormPage({
        mode: 'create',
        values: emptyValues(),
        errors: {},
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '填寫工作內容、要求與預設月薪，公開後求職者就能私訊應徵。',
    );
  }, only);

  router.post('/employer/jobs/new', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const parsed = parseJobForm(form);

    if (parsed.input === null) {
      page(
        ctx,
        '刊登新職缺',
        jobFormPage({
          mode: 'create',
          values: parsed.values,
          errors: parsed.errors,
          csrfToken: ctx.session?.csrf ?? '',
        }),
        '請修正表單中的錯誤。',
      );
      return;
    }

    try {
      const job = ctx.services.store.mutate((db) => createJob(db, user, parsed.input as JobFormInput, nowISO()));
      ctx.flash('success', `職缺「${job.title}」已刊登。`);
      ctx.redirect('/employer');
    } catch (err) {
      parsed.errors['form'] = err instanceof Error ? err.message : '刊登失敗';
      page(
        ctx,
        '刊登新職缺',
        jobFormPage({
          mode: 'create',
          values: parsed.values,
          errors: parsed.errors,
          csrfToken: ctx.session?.csrf ?? '',
        }),
        '請修正表單中的錯誤。',
      );
    }
  }, only);

  router.get('/employer/jobs/:id/edit', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');
    if (job.employerId !== user.id) throw notFound('找不到這個職缺');

    page(
      ctx,
      '編輯職缺',
      jobFormPage({
        mode: 'edit',
        jobId: job.id,
        values: jobToFormValues(job),
        errors: {},
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '更新職缺內容後，搜尋結果會立即反映。',
    );
  }, only);

  router.post('/employer/jobs/:id/edit', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');
    if (job.employerId !== user.id) throw notFound('找不到這個職缺');
    const parsed = parseJobForm(form);

    if (parsed.input === null) {
      page(
        ctx,
        '編輯職缺',
        jobFormPage({
          mode: 'edit',
          jobId: job.id,
          values: parsed.values,
          errors: parsed.errors,
          csrfToken: ctx.session?.csrf ?? '',
        }),
        '請修正表單中的錯誤。',
      );
      return;
    }

    try {
      ctx.services.store.mutate((target) => {
        const stored = needJob(target, job.id);
        updateJob(stored, parsed.input as JobFormInput, nowISO());
      });
      ctx.flash('success', `職缺「${job.title}」已更新。`);
      ctx.redirect('/employer');
    } catch (err) {
      parsed.errors['form'] = err instanceof Error ? err.message : '更新失敗';
      page(
        ctx,
        '編輯職缺',
        jobFormPage({
          mode: 'edit',
          jobId: job.id,
          values: parsed.values,
          errors: parsed.errors,
          csrfToken: ctx.session?.csrf ?? '',
        }),
        '請修正表單中的錯誤。',
      );
    }
  }, only);

  router.post('/employer/jobs/:id/visibility', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');
    if (job.employerId !== user.id) throw notFound('找不到這個職缺');
    const published = form.get('published') === '1';

    ctx.services.store.mutate((target) => {
      const stored = needJob(target, job.id);
      setPublished(stored, published, nowISO());
    });
    ctx.flash('success', published ? '職缺已重新公開。' : '職缺已關閉，不會再出現在搜尋結果。');
    ctx.redirect('/employer');
  }, only);

  router.post('/employer/jobs/:id/promote', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const days = Number.parseInt(form.get('days') ?? '', 10);
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');

    try {
      const plan = needPlan(days);
      const promotion = ctx.services.store.mutate((target) => {
        const storedJob = needJob(target, job.id);
        const storedUser = target.users.find((item) => item.id === user.id);
        if (storedUser === undefined) throw notFound('找不到你的帳號');
        return purchasePromotion(target, storedUser, storedJob, plan, nowISO());
      });
      ctx.flash(
        'success',
        `已購買「${plan.label}」，職缺曝光延長至 ${new Date(promotion.expiresAt).toLocaleDateString('zh-TW')}。`,
      );
    } catch (err) {
      ctx.flash('error', err instanceof Error ? err.message : '購買曝光失敗');
    }
    ctx.redirect('/employer');
  }, only);
}
