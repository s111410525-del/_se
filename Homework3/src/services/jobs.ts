import { badRequest, notFound } from '../core/errors.js';
import type {
  Database,
  EmploymentType,
  Job,
  JobCategory,
  JobSort,
  User,
} from '../types.js';
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  JOB_SORT_LABELS,
  JOB_RULES,
} from '../types.js';
import { newId } from '../util/id.js';
import { activePromotion, activePromotionMap } from './promotion.js';

export interface JobFilters {
  q: string;
  category: string;
  employmentType: string;
  location: string;
  salaryMin: number;
  sort: JobSort;
}

export const JOB_SORTS: JobSort[] = ['recommend', 'newest', 'salary', 'popular'];

export function parseJobSort(value: string | null): JobSort {
  return JOB_SORTS.includes(value as JobSort) ? (value as JobSort) : 'recommend';
}

export function publishedJobs(db: Database): Job[] {
  return db.jobs.filter((job) => job.published);
}

export function employerJobs(db: Database, employerId: string): Job[] {
  return db.jobs
    .filter((job) => job.employerId === employerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function needJob(db: Database, id: string): Job {
  const job = db.jobs.find((item) => item.id === id);
  if (job === undefined) throw notFound('找不到這個職缺');
  return job;
}

export function canViewJob(job: Job, user: User | undefined): boolean {
  if (job.published) return true;
  return user !== undefined && (user.id === job.employerId || user.role === 'admin');
}

export function canManageJob(job: Job, user: User | undefined): boolean {
  return user !== undefined && (user.id === job.employerId || user.role === 'admin');
}

function matchesQuery(job: Job, db: Database, query: string): boolean {
  if (query === '') return true;
  const employer = db.users.find((user) => user.id === job.employerId);
  const haystack = [
    job.title,
    job.description,
    job.requirements,
    job.location,
    job.tags.join(' '),
    employer?.company ?? '',
    employer?.name ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/u)
    .filter((token) => token !== '')
    .every((token) => haystack.includes(token));
}

function effectiveSalary(job: Job): number {
  return job.salaryMax > 0 ? job.salaryMax : job.salaryMin;
}

/** 篩選與排序職缺。推薦排序會把付費曝光職缺排在最前面。 */
export function filterJobs(db: Database, jobs: Job[], filters: JobFilters, now: number = Date.now()): Job[] {
  const promoted = activePromotionMap(
    db,
    jobs.map((job) => job.id),
    now,
  );

  const filtered = jobs.filter((job) => {
    if (!matchesQuery(job, db, filters.q)) return false;
    if (filters.category !== '' && job.category !== filters.category) return false;
    if (filters.employmentType !== '' && job.employmentType !== filters.employmentType) return false;
    if (filters.location !== '' && !job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.salaryMin > 0 && effectiveSalary(job) < filters.salaryMin) return false;
    return true;
  });

  const byNewest = (a: Job, b: Job): number => Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return filtered.sort((a, b) => {
    if (filters.sort === 'recommend') {
      const aPromoted = promoted.has(a.id) ? 1 : 0;
      const bPromoted = promoted.has(b.id) ? 1 : 0;
      if (aPromoted !== bPromoted) return bPromoted - aPromoted;
      return byNewest(a, b);
    }
    if (filters.sort === 'newest') return byNewest(a, b);
    if (filters.sort === 'salary') return effectiveSalary(b) - effectiveSalary(a) || byNewest(a, b);
    return b.views - a.views || byNewest(a, b);
  });
}

export function sortLabel(sort: JobSort): string {
  return JOB_SORT_LABELS[sort];
}

export interface JobFormInput {
  title: string;
  category: JobCategory;
  employmentType: EmploymentType;
  location: string;
  description: string;
  requirements: string;
  benefits: string;
  tags: string[];
  salaryMin: number;
  salaryMax: number;
  salaryNote: string;
  published: boolean;
}

function validateJobInput(input: JobFormInput): void {
  if (input.salaryMin < 0 || input.salaryMax < 0) throw badRequest('薪資不可為負數');
  if (input.salaryMin > JOB_RULES.salaryMax || input.salaryMax > JOB_RULES.salaryMax) {
    throw badRequest(`薪資不可超過 ${JOB_RULES.salaryMax.toLocaleString('zh-TW')} 元`);
  }
  if (input.salaryMax > 0 && input.salaryMin > input.salaryMax) {
    throw badRequest('月薪下限不可高於上限');
  }
  if (input.tags.length > JOB_RULES.tagLimit) {
    throw badRequest(`標籤最多 ${JOB_RULES.tagLimit} 個`);
  }
}

export function createJob(db: Database, employer: User, input: JobFormInput, nowISO: string): Job {
  validateJobInput(input);
  const job: Job = {
    id: newId('job'),
    employerId: employer.id,
    ...input,
    createdAt: nowISO,
    updatedAt: nowISO,
    views: 0,
  };
  db.jobs.push(job);
  return job;
}

export function updateJob(job: Job, input: JobFormInput, nowISO: string): Job {
  validateJobInput(input);
  Object.assign(job, input, { updatedAt: nowISO });
  return job;
}

export function setPublished(job: Job, published: boolean, nowISO: string): void {
  if (job.published === published) return;
  job.published = published;
  job.updatedAt = nowISO;
}

export function recordJobView(job: Job): void {
  job.views += 1;
}

export function jobPromoted(job: Job, db: Database, now: number = Date.now()): boolean {
  return activePromotion(db, job.id, now) !== undefined;
}

/** 首頁與篩選器共用的分類統計（只計算公開職缺）。 */
export function categoryCounts(db: Database): { category: JobCategory; count: number }[] {
  const publicJobs = publishedJobs(db);
  return JOB_CATEGORIES.map((category) => ({
    category,
    count: publicJobs.filter((job) => job.category === category).length,
  })).filter((entry) => entry.count > 0);
}

/** 驗證分類與工作型態字串，供路由解析查詢參數使用。 */
export function parseCategory(value: string | null): string {
  return value !== null && (JOB_CATEGORIES as string[]).includes(value) ? value : '';
}

export function parseEmploymentType(value: string | null): string {
  return value !== null && (EMPLOYMENT_TYPES as string[]).includes(value) ? value : '';
}
