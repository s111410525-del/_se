import type { Database, Job, LedgerEntry, Promotion, Topup, User } from '../../types.js';
import {
  JOB_CATEGORY_LABELS,
  LEDGER_KIND_LABELS,
  ROLE_LABELS,
} from '../../types.js';
import { activePromotion } from '../../services/promotion.js';
import { totalPromotionRevenue, totalTopups } from '../../services/wallet.js';
import { jobHref, statCard } from '../components.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from '../../util/html.js';

export function adminDashboardPage(db: Database): string {
  const publicJobs = db.jobs.filter((job) => job.published).length;
  const seekers = db.users.filter((user) => user.role === 'seeker').length;
  const employers = db.users.filter((user) => user.role === 'employer').length;
  const activePromotions = db.promotions.filter((promotion) => Date.parse(promotion.expiresAt) > Date.now()).length;

  const menu: [string, string, string][] = [
    ['/admin/jobs', '職缺管理', '查看所有職缺、上下架與贈送曝光'],
    ['/admin/users', '使用者', '求職者、企業與錢包餘額'],
    ['/admin/transactions', '交易紀錄', '儲值、曝光扣款與錢包流水'],
  ];

  return `<div class="grid cols-4" style="margin-bottom:20px">
    ${statCard('註冊帳號', formatNumber(db.users.length), `${seekers} 位求職者 · ${employers} 間企業`)}
    ${statCard('職缺總數', formatNumber(db.jobs.length), `${publicJobs} 個公開中`)}
    ${statCard('應徵對話', formatNumber(db.conversations.length), `${db.messages.length} 則訊息`)}
    ${statCard('進行中曝光', formatNumber(activePromotions), '含錢包與平台贈送', activePromotions > 0 ? 'gold' : '')}
    ${statCard('儲值總額', formatMoney(totalTopups(db)), '模擬金流', 'gold')}
    ${statCard('曝光收入', formatMoney(totalPromotionRevenue(db)), '企業購買方案')}
    ${statCard('平台職缺', formatNumber(db.jobs.filter((job) => job.employerId === 'u_admin').length), '由平台帳號刊登')}
    ${statCard('未讀訊息', '—', '由使用者自行讀取')}
  </div>
  <div class="section-head" style="margin-top:0"><div><h2>管理功能</h2><p>平台營運的日常工作。</p></div></div>
  <div class="grid cols-3">
    ${menu
      .map(
        ([href, title, desc]) => `<a class="card" href="${href}" style="margin:0;text-decoration:none;color:inherit">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted" style="font-size:13px;margin:0">${escapeHtml(desc)}</p>
      </a>`,
      )
      .join('')}
  </div>`;
}

export function adminUsersPage(db: Database): string {
  const rows = [...db.users]
    .sort((a, b) => a.role.localeCompare(b.role) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((user: User) => {
      const jobs = db.jobs.filter((job) => job.employerId === user.id);
      const applications = db.conversations.filter(
        (conversation) => conversation.seekerId === user.id || conversation.employerId === user.id,
      );
      return `<tr>
      <td><b>${escapeHtml(user.name)}</b><div class="inline-note">@${escapeHtml(user.username)} · ${escapeHtml(user.email)}</div></td>
      <td>${escapeHtml(ROLE_LABELS[user.role])}<div class="inline-note">${escapeHtml(user.company)}</div></td>
      <td class="num">${user.role === 'employer' ? formatMoney(user.balance) : '—'}</td>
      <td class="num">${user.role === 'employer' ? jobs.length : '—'}</td>
      <td class="num">${applications.length}</td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
    </tr>`;
    })
    .join('');

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>使用者</th><th>角色／公司</th><th class="num">錢包</th><th class="num">職缺</th><th class="num">對話</th><th>註冊</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export interface AdminJobsOptions {
  db: Database;
  jobs: Job[];
  csrfToken: string;
}

export function adminJobsPage(options: AdminJobsOptions): string {
  const { db } = options;
  const rows = options.jobs
    .map((job) => {
      const employer = db.users.find((user) => user.id === job.employerId);
      const promotion: Promotion | undefined = activePromotion(db, job.id);
      return `<tr>
      <td><b><a href="${jobHref(job)}">${escapeHtml(job.title)}</a></b><div class="inline-note">${escapeHtml(JOB_CATEGORY_LABELS[job.category])} · ${escapeHtml(job.location)}</div></td>
      <td>${escapeHtml(employer?.company !== undefined && employer.company !== '' ? employer.company : employer?.name ?? '—')}<div class="inline-note">${escapeHtml(employer?.email ?? '')}</div></td>
      <td>${job.published ? '<span class="badge ok">公開</span>' : '<span class="badge err">關閉</span>'}</td>
      <td class="num">${formatNumber(job.views)}</td>
      <td class="num">${db.conversations.filter((conversation) => conversation.jobId === job.id).length}</td>
      <td>${promotion === undefined ? '<span class="badge muted">無</span>' : `<span class="badge promo">至 ${escapeHtml(formatDate(promotion.expiresAt))}</span>`}</td>
      <td><div class="actions">
        <form method="post" action="/admin/jobs/${encodeURIComponent(job.id)}/promote" style="margin:0">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <button class="btn gold small" type="submit">贈送 7 天曝光</button>
        </form>
        <form method="post" action="/admin/jobs/${encodeURIComponent(job.id)}/visibility" style="margin:0" data-confirm="確定要${job.published ? '關閉' : '公開'}這個職缺嗎？">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <input type="hidden" name="published" value="${job.published ? '0' : '1'}">
          <button class="btn ${job.published ? 'danger' : 'ghost'} small" type="submit">${job.published ? '關閉' : '公開'}</button>
        </form>
      </div></td>
    </tr>`;
    })
    .join('');

  return `<p class="inline-note" style="margin-bottom:12px">管理員可替任何職缺贈送 7 天曝光，不扣企業錢包；上下架會立即影響搜尋結果。</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>職缺</th><th>企業</th><th>狀態</th><th class="num">瀏覽</th><th class="num">應徵</th><th>曝光</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export interface AdminTransactionsOptions {
  db: Database;
  topups: Topup[];
  ledger: LedgerEntry[];
}

export function adminTransactionsPage(options: AdminTransactionsOptions): string {
  const { db } = options;
  const nameOf = (id: string): string => {
    const user = db.users.find((item) => item.id === id);
    return user?.company !== undefined && user.company !== '' ? user.company : (user?.name ?? id);
  };

  const topupRows = options.topups.length === 0
    ? '<tr><td colspan="5" class="muted">目前沒有儲值紀錄。</td></tr>'
    : options.topups
        .map(
          (topup) => `<tr>
        <td>${escapeHtml(nameOf(topup.userId))}</td>
        <td class="num">${formatMoney(topup.amount)}</td>
        <td>${escapeHtml(topup.method)}</td>
        <td>${escapeHtml(formatDateTime(topup.createdAt))}</td>
        <td class="inline-note">${escapeHtml(topup.id)}</td>
      </tr>`,
        )
        .join('');

  const ledgerRows = options.ledger.length === 0
    ? '<tr><td colspan="6" class="muted">目前沒有錢包流水。</td></tr>'
    : options.ledger
        .map(
          (entry) => `<tr>
        <td>${escapeHtml(nameOf(entry.userId))}</td>
        <td>${escapeHtml(LEDGER_KIND_LABELS[entry.kind])}</td>
        <td>${escapeHtml(entry.note)}</td>
        <td class="num" style="color:${entry.amount >= 0 ? 'var(--ok)' : 'var(--err)'}">${entry.amount >= 0 ? '+' : ''}${formatMoney(entry.amount)}</td>
        <td class="num">${formatMoney(entry.balanceAfter)}</td>
        <td>${escapeHtml(formatDateTime(entry.createdAt))}</td>
      </tr>`,
        )
        .join('');

  return `<div class="grid cols-3" style="margin-bottom:20px">
    ${statCard('儲值筆數', formatNumber(options.topups.length), '模擬付款')}
    ${statCard('儲值總額', formatMoney(totalTopups(db)), '平台入帳')}
    ${statCard('曝光收入', formatMoney(totalPromotionRevenue(db)), '企業購買')}
  </div>
  <section class="card">
    <h2>儲值紀錄</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>企業</th><th class="num">金額</th><th>方式</th><th>時間</th><th>編號</th></tr></thead>
        <tbody>${topupRows}</tbody>
      </table>
    </div>
  </section>
  <section class="card">
    <h2>錢包流水</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>使用者</th><th>類型</th><th>說明</th><th class="num">金額</th><th class="num">餘額</th><th>時間</th></tr></thead>
        <tbody>${ledgerRows}</tbody>
      </table>
    </div>
  </section>`;
}
