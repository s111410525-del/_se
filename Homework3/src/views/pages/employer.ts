import type {
  Conversation,
  Database,
  Job,
  Promotion,
  PromotionPlan,
  User,
} from '../../types.js';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  PROMOTION_PLANS,
} from '../../types.js';
import type { Errors } from '../../core/validate.js';
import {
  conversationList,
  jobHref,
  sectionHeader,
  statCard,
} from '../components.js';
import {
  escapeHtml,
  formatDate,
  formatMoney,
  formatNumber,
  timeAgo,
} from '../../util/html.js';

export interface EmployerDashboardOptions {
  db: Database;
  user: User;
  jobs: Job[];
  promotedMap: Map<string, Promotion>;
  applicationCounts: Map<string, number>;
  applications: Conversation[];
  activePromotions: Promotion[];
  balance: number;
  csrfToken: string;
}

export function employerDashboardPage(options: EmployerDashboardOptions): string {
  const { db, user, jobs } = options;
  const totalViews = jobs.reduce((sum, job) => sum + job.views, 0);
  const totalApplications = [...options.applicationCounts.values()].reduce((sum, count) => sum + count, 0);
  const openJobs = jobs.filter((job) => job.published).length;

  const rows = jobs.length === 0
    ? `<div class="empty">你還沒有刊登職缺。<div style="margin-top:12px"><a class="btn small" href="/employer/jobs/new">刊登第一個職缺</a></div></div>`
    : `<div class="grid">${jobs.map((job) => employerJobCard(job, options)).join('')}</div>`;

  return `<div class="grid cols-4" style="margin-bottom:18px">
    ${statCard('公開職缺', formatNumber(openJobs), `共 ${jobs.length} 個職缺`)}
    ${statCard('總瀏覽', formatNumber(totalViews), '所有職缺累計')}
    ${statCard('收到應徵', formatNumber(totalApplications), `${options.applications.length} 則對話`)}
    ${statCard('錢包餘額', formatMoney(options.balance), '可用於購買曝光', 'gold')}
  </div>

  <div class="balance-card">
    <div class="label">WALLET BALANCE</div>
    <div class="amount">${formatMoney(options.balance)}</div>
    <p>儲值後可替你刊登的職缺購買曝光。曝光中的職缺會優先出現在探索頁與搜尋結果。</p>
    <div class="actions">
      <a class="btn gold" href="/wallet">前往儲值</a>
      <a class="btn ghost-light" href="/employer/jobs/new">＋ 刊登新職缺</a>
    </div>
  </div>

  <div class="card">
    <h2>曝光方案</h2>
    <p class="inline-note" style="margin-top:-6px">每次購買會延長該職缺的曝光期限；已有曝光時直接累加天數。</p>
    <div class="plan-grid">
      ${PROMOTION_PLANS.map(
        (plan) =>
          `<div class="plan-card"><h3>${escapeHtml(plan.label)}</h3><div class="price">${formatMoney(plan.price)}</div><div class="hint">${escapeHtml(plan.hint)}</div></div>`,
      ).join('')}
    </div>
  </div>

  ${sectionHeader('我的職缺', '管理刊登內容、上下架與付費曝光。')}
  ${rows}

  ${sectionHeader('最近的應徵', '求職者透過私訊應徵，會在訊息中心建立對話。', '/messages')}
  ${conversationList(db, options.applications.slice(0, 4), user)}
`;
}

function employerJobCard(job: Job, options: EmployerDashboardOptions): string {
  const promoted = options.promotedMap.get(job.id);
  const applicationCount = options.applicationCounts.get(job.id) ?? 0;
  const promoteButtons = PROMOTION_PLANS.map((plan) => promoteButton(job, plan, options)).join('');
  const publishedBadge = job.published ? '<span class="badge ok">公開中</span>' : '<span class="badge err">已關閉</span>';
  const promotedBadge = promoted === undefined
    ? ''
    : `<span class="badge promo">曝光至 ${formatDate(promoted.expiresAt)}</span>`;

  return `<article class="card" style="margin:0">
    <div class="detail-head">
      <div>
        <div class="badge-row">${publishedBadge}${promotedBadge}<span class="badge muted">${JOB_CATEGORY_LABELS[job.category]}</span></div>
        <h2 style="margin:0 0 4px;font-size:19px"><a href="${jobHref(job)}" style="color:var(--text)">${escapeHtml(job.title)}</a></h2>
        <div class="inline-note">📍 ${escapeHtml(job.location)} · 👁 ${formatNumber(job.views)} · 應徵 ${applicationCount} · ${escapeHtml(timeAgo(job.updatedAt))}更新</div>
      </div>
      <div class="actions">
        <a class="btn ghost small" href="/employer/jobs/${encodeURIComponent(job.id)}/edit">編輯</a>
        <form method="post" action="/employer/jobs/${encodeURIComponent(job.id)}/visibility" style="margin:0" data-confirm="${job.published ? '確定要關閉這個職缺嗎？關閉後將不再出現在搜尋結果。' : '確定要重新公開這個職缺嗎？'}">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <input type="hidden" name="published" value="${job.published ? '0' : '1'}">
          <button class="btn ${job.published ? 'danger' : ''} small" type="submit">${job.published ? '關閉職缺' : '重新公開'}</button>
        </form>
      </div>
    </div>
    <div class="promo-panel">
      <div class="inline-note">購買曝光（錢包餘額 ${formatMoney(options.balance)}）</div>
      <div class="promo-options">${promoteButtons}</div>
    </div>
  </article>`;
}

function promoteButton(job: Job, plan: PromotionPlan, options: EmployerDashboardOptions): string {
  const insufficient = options.balance < plan.price;
  const disabled = insufficient || !job.published;
  const hint = !job.published ? '請先公開職缺' : insufficient ? '餘額不足' : '';
  return `<form method="post" action="/employer/jobs/${encodeURIComponent(job.id)}/promote" style="margin:0" data-confirm="確定花費 ${formatMoney(plan.price)} 購買「${escapeHtml(plan.label)}」嗎？">
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <input type="hidden" name="days" value="${plan.days}">
    <button class="btn gold small" type="submit"${disabled ? ' disabled title="' + escapeHtml(hint) + '"' : ''}>${escapeHtml(plan.label)} · ${formatMoney(plan.price)}</button>
  </form>`;
}

export interface JobFormValues {
  title: string;
  category: string;
  employmentType: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  salaryNote: string;
  tags: string;
  description: string;
  requirements: string;
  benefits: string;
  published: string;
}

export interface JobFormPageOptions {
  mode: 'create' | 'edit';
  values: JobFormValues;
  errors: Errors;
  csrfToken: string;
  jobId?: string;
}

export function jobFormPage(options: JobFormPageOptions): string {
  const { values, errors } = options;
  const summary = Object.keys(errors).length === 0
    ? ''
    : `<div class="alert alert-error" role="alert">${escapeHtml(Object.values(errors).join('　'))}</div>`;
  const categoryOptions = JOB_CATEGORIES
    .map(
      (category) =>
        `<option value="${category}"${values.category === category ? ' selected' : ''}>${JOB_CATEGORY_LABELS[category]}</option>`,
    )
    .join('');
  const typeOptions = EMPLOYMENT_TYPES
    .map(
      (type) =>
        `<option value="${type}"${values.employmentType === type ? ' selected' : ''}>${EMPLOYMENT_TYPE_LABELS[type]}</option>`,
    )
    .join('');
  const error = (name: string): string => errors[name] === undefined
    ? ''
    : `<span class="error">${escapeHtml(errors[name])}</span>`;
  const action = options.mode === 'create' || options.jobId === undefined
    ? '/employer/jobs/new'
    : `/employer/jobs/${encodeURIComponent(options.jobId)}/edit`;

  return `<section class="card">
  <h2>${options.mode === 'create' ? '刊登新職缺' : '編輯職缺'}</h2>
  <p class="inline-note" style="margin-top:-6px">職缺會公開在探索頁與搜尋結果；工作要求與預設月薪會清楚顯示給求職者。</p>
  ${summary}
  <form method="post" action="${action}" class="stack" style="max-width:none">
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <div class="form-grid">
      <div class="field">
        <label for="title">職缺名稱</label>
        <input id="title" type="text" name="title" value="${escapeHtml(values.title)}" maxlength="60" required>
        ${error('title')}
      </div>
      <div class="field">
        <label for="category">職缺分類</label>
        <select id="category" name="category" required>${categoryOptions}</select>
        ${error('category')}
      </div>
      <div class="field">
        <label for="employmentType">工作型態</label>
        <select id="employmentType" name="employmentType" required>${typeOptions}</select>
        ${error('employmentType')}
      </div>
      <div class="field">
        <label for="location">工作地點</label>
        <input id="location" type="text" name="location" value="${escapeHtml(values.location)}" maxlength="60" placeholder="例如：台北市信義區（可遠端）" required>
        ${error('location')}
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="salaryMin">月薪下限（元）</label>
        <input id="salaryMin" type="number" name="salaryMin" value="${escapeHtml(values.salaryMin)}" min="0" max="1000000" step="1000" placeholder="45000">
        <span class="hint">留 0 或不填表示面議</span>
        ${error('salaryMin')}
      </div>
      <div class="field">
        <label for="salaryMax">月薪上限（元）</label>
        <input id="salaryMax" type="number" name="salaryMax" value="${escapeHtml(values.salaryMax)}" min="0" max="1000000" step="1000" placeholder="60000">
        ${error('salaryMax')}
      </div>
      <div class="field">
        <label for="salaryNote">薪資補充</label>
        <input id="salaryNote" type="text" name="salaryNote" value="${escapeHtml(values.salaryNote)}" maxlength="80" placeholder="例如：保障年薪 14 個月">
        ${error('salaryNote')}
      </div>
      <div class="field">
        <label for="tags">標籤</label>
        <input id="tags" type="text" name="tags" value="${escapeHtml(values.tags)}" maxlength="120" placeholder="React, TypeScript, 遠端">
        <span class="hint">以逗號分隔，最多 8 個</span>
        ${error('tags')}
      </div>
    </div>
    <div class="field">
      <label for="description">工作內容</label>
      <textarea id="description" name="description" class="tall" maxlength="4000" required placeholder="介紹這個職位的工作內容、團隊組成與日常任務。">${escapeHtml(values.description)}</textarea>
      ${error('description')}
    </div>
    <div class="field">
      <label for="requirements">工作要求</label>
      <textarea id="requirements" name="requirements" class="tall" maxlength="3000" required placeholder="列出必要條件、加分條件與需要的技能。">${escapeHtml(values.requirements)}</textarea>
      ${error('requirements')}
    </div>
    <div class="field">
      <label for="benefits">福利與環境</label>
      <textarea id="benefits" name="benefits" maxlength="1000" placeholder="例如：彈性工時、遠端補助、年度獎金。">${escapeHtml(values.benefits)}</textarea>
      ${error('benefits')}
    </div>
    <div class="field">
      <label class="check-line"><input type="checkbox" name="published" value="1"${values.published === '1' ? ' checked' : ''}> 立即公開職缺</label>
    </div>
    <div class="form-actions">
      <button class="btn" type="submit">${options.mode === 'create' ? '刊登職缺' : '儲存變更'}</button>
      <a class="btn ghost" href="/employer">取消</a>
    </div>
  </form>
</section>`;
}

/** 從職缺建立表單預設值。 */
export function jobToFormValues(job: Job): JobFormValues {
  return {
    title: job.title,
    category: job.category,
    employmentType: job.employmentType,
    location: job.location,
    salaryMin: job.salaryMin > 0 ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax > 0 ? String(job.salaryMax) : '',
    salaryNote: job.salaryNote,
    tags: job.tags.join(', '),
    description: job.description,
    requirements: job.requirements,
    benefits: job.benefits,
    published: job.published ? '1' : '',
  };
}


