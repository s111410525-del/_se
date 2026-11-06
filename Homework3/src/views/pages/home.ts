import type { Conversation, Database, Job, JobCategory, JobSort, Promotion, User } from '../../types.js';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_CATEGORIES,
  JOB_CATEGORY_EMOJI,
  JOB_CATEGORY_LABELS,
  JOB_SORT_LABELS,
} from '../../types.js';
import {
  conversationStatusBadge,
  jobCard,
  jobGrid,
  jobHref,
  sectionHeader,
  tagList,
} from '../components.js';
import {
  escapeHtml,
  formatDate,
  formatMoney,
  formatNumber,
  formatSalary,
  paragraphs,
  timeAgo,
  truncate,
} from '../../util/html.js';

export interface HomeStats {
  jobs: number;
  employers: number;
  seekers: number;
  promotions: number;
}

export interface HomeOptions {
  db: Database;
  user: User | undefined;
  promoted: Job[];
  newest: Job[];
  promotedIds: Set<string>;
  categories: { category: JobCategory; count: number }[];
  stats: HomeStats;
}

export function homePage(options: HomeOptions): string {
  const { db } = options;
  const promotedGrid = options.promoted.length === 0
    ? '<div class="empty">目前沒有付費曝光的職缺，企業可以到徵才中心購買曝光。</div>'
    : `<div class="job-grid">${options.promoted
        .map((job) => jobCard(db, job, { promoted: true }))
        .join('')}</div>`;

  const newestGrid = options.newest.length === 0
    ? '<div class="empty">目前還沒有公開職缺。</div>'
    : `<div class="job-grid">${options.newest.map((job) => jobCard(db, job, { promoted: options.promotedIds.has(job.id) })).join('')}</div>`;

  const categories = options.categories
    .map(
      (entry) =>
        `<a class="chip" href="/jobs?category=${encodeURIComponent(entry.category)}">${JOB_CATEGORY_EMOJI[entry.category]} ${JOB_CATEGORY_LABELS[entry.category]} <span class="muted">${entry.count}</span></a>`,
    )
    .join('');

  return `<section class="hero">
  <div class="hero-inner">
    <span class="eyebrow">FIND WORK · BE SEEN</span>
    <h1>找到下一份<br>值得投入的工作。</h1>
    <p>瀏覽工作內容、要求與預設月薪，免費註冊後直接私訊發布職缺的企業。企業也能刊登徵人訊息，用儲值曝光讓職缺被更多人看見。</p>
    <form class="hero-search" method="get" action="/jobs">
      <input type="search" name="q" placeholder="搜尋職稱、公司、技能，例如：前端、設計、行銷">
      <button class="btn" type="submit">搜尋工作</button>
    </form>
    <div class="hero-facts">
      <div class="hero-fact"><b>${formatNumber(options.stats.jobs)}</b><span>公開職缺</span></div>
      <div class="hero-fact"><b>${formatNumber(options.stats.employers)}</b><span>企業雇主</span></div>
      <div class="hero-fact"><b>${formatNumber(options.stats.seekers)}</b><span>求職者</span></div>
      <div class="hero-fact"><b>${formatNumber(options.stats.promotions)}</b><span>進行中曝光</span></div>
    </div>
  </div>
</section>

<div class="chip-row" style="margin-bottom:8px">${categories}</div>

${sectionHeader('正在曝光的工作', '企業付費曝光，讓合適的人才優先看到。', '/jobs?sort=recommend')}
${promotedGrid}

${sectionHeader('最新職缺', '剛剛刊登與最近更新的工作機會。', '/jobs?sort=newest')}
${newestGrid}

${sectionHeader('怎麼開始？', '三個步驟完成求職或徵才。')}
<div class="steps">
  <div class="step"><b>1</b><h3>免費註冊</h3><p>選擇求職者或企業身分，建立帳號不收費。</p></div>
  <div class="step"><b>2</b><h3>私訊應徵</h3><p>看到喜歡的職缺，送出訊息直接聯繫發布者。</p></div>
  <div class="step"><b>3</b><h3>持續對話</h3><p>在訊息中心追蹤進度，企業可回覆並邀請面談。</p></div>
</div>`;
}

export interface JobsPageOptions {
  db: Database;
  user: User | undefined;
  jobs: Job[];
  promotedIds: Set<string>;
  appliedJobIds: Set<string>;
  categories: { category: JobCategory; count: number }[];
  filters: {
    q: string;
    category: string;
    employmentType: string;
    location: string;
    salaryMin: number;
    sort: JobSort;
  };
  total: number;
}

export function jobsPage(options: JobsPageOptions): string {
  const { filters } = options;
  const categoryOptions = JOB_CATEGORIES
    .map(
      (category) =>
        `<option value="${category}"${filters.category === category ? ' selected' : ''}>${JOB_CATEGORY_LABELS[category]}</option>`,
    )
    .join('');
  const typeOptions = EMPLOYMENT_TYPES
    .map(
      (type) =>
        `<option value="${type}"${filters.employmentType === type ? ' selected' : ''}>${EMPLOYMENT_TYPE_LABELS[type]}</option>`,
    )
    .join('');
  const sortOptions = (Object.keys(JOB_SORT_LABELS) as JobSort[])
    .map(
      (sort) => `<option value="${sort}"${filters.sort === sort ? ' selected' : ''}>${JOB_SORT_LABELS[sort]}</option>`,
    )
    .join('');
  const chips = options.categories
    .map(
      (entry) =>
        `<a class="chip${filters.category === entry.category ? ' active' : ''}" href="/jobs?category=${encodeURIComponent(entry.category)}">${JOB_CATEGORY_EMOJI[entry.category]} ${JOB_CATEGORY_LABELS[entry.category]} <span class="muted">${entry.count}</span></a>`,
    )
    .join('');

  return `<form class="filters" method="get" action="/jobs">
  <div class="field grow">
    <label for="q">關鍵字</label>
    <input id="q" type="search" name="q" value="${escapeHtml(filters.q)}" placeholder="職稱、公司、技能">
  </div>
  <div class="field">
    <label for="category">分類</label>
    <select id="category" name="category">
      <option value="">全部分類</option>
      ${categoryOptions}
    </select>
  </div>
  <div class="field">
    <label for="employmentType">工作型態</label>
    <select id="employmentType" name="employmentType">
      <option value="">不拘</option>
      ${typeOptions}
    </select>
  </div>
  <div class="field">
    <label for="location">地點</label>
    <input id="location" type="text" name="location" value="${escapeHtml(filters.location)}" placeholder="例如：台北">
  </div>
  <div class="field" style="max-width:150px">
    <label for="salaryMin">月薪至少</label>
    <input id="salaryMin" type="number" name="salaryMin" value="${filters.salaryMin > 0 ? filters.salaryMin : ''}" min="0" step="1000" placeholder="40000">
  </div>
  <div class="field" style="max-width:150px">
    <label for="sort">排序</label>
    <select id="sort" name="sort">
      ${sortOptions}
    </select>
  </div>
  <button class="btn" type="submit">套用篩選</button>
  <a class="btn ghost" href="/jobs">清除</a>
</form>

<div class="chip-row" style="margin-bottom:16px">${chips}</div>

<div class="filter-summary">
  <span>共 <b>${formatNumber(options.total)}</b> 個職缺${filters.q === '' ? '' : `，關鍵字「${escapeHtml(filters.q)}」`}</span>
  <span>${escapeHtml(JOB_SORT_LABELS[filters.sort])}</span>
</div>

${jobGrid(options.db, options.jobs, options.promotedIds, options.appliedJobIds)}`;
}

export interface JobDetailOptions {
  db: Database;
  job: Job;
  employer: User | undefined;
  user: User | undefined;
  promotion: Promotion | undefined;
  conversation: Conversation | undefined;
  similar: Job[];
  promotedIds: Set<string>;
  csrfToken: string;
}

export function jobDetailPage(options: JobDetailOptions): string {
  const { db, job, employer, user, promotion } = options;
  const promoted = promotion !== undefined;
  const company = employer?.company !== undefined && employer.company !== '' ? employer.company : (employer?.name ?? '未知企業');
  const isOwner = user !== undefined && (user.id === job.employerId || user.role === 'admin');
  const banner = job.published ? '' : '<div class="notice">這個職缺目前未公開，只有你與平台管理員看得到。</div>';

  return `${banner}
<article class="card">
  <div class="detail-head">
    <div>
      <div class="badge-row">
        <span class="badge">${JOB_CATEGORY_LABELS[job.category]}</span>
        <span class="badge muted">${EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>
        ${promoted ? '<span class="badge promo">付費曝光中</span>' : ''}
      </div>
      <h1>${escapeHtml(job.title)}</h1>
      <div class="detail-company">🏢 <a href="/companies/${encodeURIComponent(job.employerId)}">${escapeHtml(company)}</a> <span class="muted">·</span> <span class="muted">${escapeHtml(timeAgo(job.createdAt))}刊登</span></div>
    </div>
    ${isOwner ? `<div class="actions"><a class="btn ghost small" href="/employer/jobs/${encodeURIComponent(job.id)}/edit">編輯職缺</a></div>` : ''}
  </div>

  <div class="salary-big">${escapeHtml(formatSalary(job.salaryMin, job.salaryMax, job.salaryNote))}</div>
  <div class="detail-meta">
    <span>📍 ${escapeHtml(job.location)}</span>
    <span>🕒 ${EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>
    <span>👁 ${formatNumber(job.views)} 次瀏覽</span>
    ${promoted ? `<span>📣 曝光至 ${escapeHtml(formatDate(promotion.expiresAt))}</span>` : ''}
  </div>

  ${tagList(job.tags)}

  <section class="detail-section">
    <h2>工作內容</h2>
    <div class="prose">${paragraphs(job.description)}</div>
  </section>

  <section class="detail-section">
    <h2>工作要求</h2>
    <div class="prose">${paragraphs(job.requirements)}</div>
  </section>

  ${job.benefits.trim() === '' ? '' : `<section class="detail-section"><h2>福利與環境</h2><div class="prose">${paragraphs(job.benefits)}</div></section>`}
</article>

<div class="two-col">
  <div>
    ${sectionHeader('相似職缺', '用分類與工作型態推荐。', `/jobs?category=${encodeURIComponent(job.category)}`)}
    ${jobGrid(db, options.similar, options.promotedIds)}
  </div>
  <div class="side-stack">
    <section class="card" style="margin:0">
      <h2>關於企業</h2>
      <div class="company-card">
        <span class="company-avatar">${escapeHtml(employer?.avatar ?? '🏢')}</span>
        <div>
          <h3><a href="/companies/${encodeURIComponent(job.employerId)}">${escapeHtml(company)}</a></h3>
          <p>${escapeHtml(employer?.bio !== undefined && employer.bio !== '' ? truncate(employer.bio, 90) : '這間企業還沒有填寫簡介。')}</p>
          <div class="inline-note" style="margin-top:6px">聯絡人：${escapeHtml(employer?.name ?? '—')}</div>
        </div>
      </div>
    </section>
    ${applyBox(options)}
  </div>
</div>`;
}

function applyBox(options: JobDetailOptions): string {
  const { job, user, conversation } = options;
  if (user === undefined) {
    return `<section class="apply-box">
      <h2>應徵這個職缺</h2>
      <p class="hint-note">應徵方式為私訊發布職缺的企業。登入求職者帳號後即可送出訊息。</p>
      <div class="actions">
        <a class="btn" href="/login?next=${encodeURIComponent(jobHref(job))}">登入後應徵</a>
        <a class="btn ghost" href="/register">免費註冊</a>
      </div>
    </section>`;
  }

  if (user.role === 'seeker') {
    if (conversation !== undefined) {
      return `<section class="apply-box">
        <h2>你的應徵進度</h2>
        <p class="hint-note">你已經應徵過這個職缺，後續請透過私訊與企業聯繫。</p>
        <div class="badge-row">${conversationStatusBadge(conversation)}</div>
        <a class="btn block" href="/messages/${encodeURIComponent(conversation.id)}">查看私訊對話</a>
      </section>`;
    }
    return `<section class="apply-box">
      <h2>私訊應徵</h2>
      <p class="hint-note">送出後會建立你與企業的私訊對話，這也是本平台的應徵方式。</p>
      <form method="post" action="/jobs/${encodeURIComponent(job.id)}/apply" class="stack" style="max-width:none">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <div class="field">
          <label for="body">給企業的訊息</label>
          <textarea id="body" name="body" maxlength="1000" required placeholder="簡短介紹自己，說明為什麼想應徵這個職缺，並附上作品集或履歷連結。">您好，我想應徵「${escapeHtml(job.title)}」，以下是我的相關經驗與作品集：</textarea>
          <span class="hint">最多 1,000 字</span>
        </div>
        <button class="btn block" type="submit">送出應徵訊息</button>
      </form>
    </section>`;
  }

  if (user.role === 'employer' && user.id === job.employerId) {
    return `<section class="apply-box">
      <h2>管理這個職缺</h2>
      <p class="hint-note">你可以編輯內容、查看應徵對話，或替職缺購買曝光。</p>
      <div class="actions">
        <a class="btn" href="/employer/jobs/${encodeURIComponent(job.id)}/edit">編輯職缺</a>
        <a class="btn ghost" href="/messages">查看應徵訊息</a>
        <a class="btn gold" href="/employer">購買曝光</a>
      </div>
    </section>`;
  }

  return `<section class="apply-box">
    <h2>應徵方式</h2>
    <p class="hint-note">只有求職者帳號可以應徵職缺。企業可到徵才中心管理自己刊登的職缺。</p>
    <a class="btn ghost block" href="/jobs">繼續找工作</a>
  </section>`;
}

export interface CompanyPageOptions {
  db: Database;
  employer: User;
  jobs: Job[];
  promotedIds: Set<string>;
}

export function companyPage(options: CompanyPageOptions): string {
  const { employer } = options;
  const name = employer.company === '' ? employer.name : employer.company;
  return `<section class="card">
    <div class="company-card">
      <span class="company-avatar" style="width:78px;height:78px;font-size:38px">${escapeHtml(employer.avatar)}</span>
      <div>
        <h1 style="margin:0 0 4px;font-size:27px">${escapeHtml(name)}</h1>
        <p style="font-size:14px;color:var(--muted)">${escapeHtml(employer.bio === '' ? '這間企業還沒有填寫簡介。' : employer.bio)}</p>
        <div class="inline-note" style="margin-top:8px">聯絡人：${escapeHtml(employer.name)} · 加入職光 ${escapeHtml(timeAgo(employer.createdAt))}</div>
      </div>
    </div>
  </section>
  ${sectionHeader('公開職缺', `共 ${options.jobs.length} 個工作機會。`)}
  ${jobGrid(options.db, options.jobs, options.promotedIds)}`;
}

/** 企業徵才中心的方案卡片。 */
export function planCards(plans: { days: number; price: number; label: string; hint: string }[]): string {
  return `<div class="plan-grid">${plans
    .map(
      (plan) =>
        `<div class="plan-card"><h3>${escapeHtml(plan.label)}</h3><div class="price">${escapeHtml(formatMoney(plan.price))}</div><div class="hint">${escapeHtml(plan.hint)}</div></div>`,
    )
    .join('')}</div>`;
}
