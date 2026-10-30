import type { Database, User, Withdrawal, Work } from '../../types.js';
import { PLAN_LABELS, WITHDRAWAL_STATUS_LABELS } from '../../types.js';
import { escapeHtml, formatDate, formatDateTime, formatMoney, formatNumber } from '../../util/html.js';
import { tipTotal } from '../../services/ranking.js';
import { planBadge, statCard, statusBadge, typeBadge, workHref } from '../components.js';

export function adminDashboard(db: Database, now: number): string {
  const published = db.works.filter((work) => work.published).length;
  const creators = db.users.filter((user) => user.role === 'member').length;
  const paidCreators = db.users.filter((user) => user.role === 'member' && user.plan === 'pro').length;
  const activePromotions = db.promotions.filter((promotion) => Date.parse(promotion.expiresAt) > now).length;
  const pending = db.withdrawals.filter((item) => item.status === 'pending');
  const pendingTotal = pending.reduce((sum, item) => sum + item.amount, 0);
  const tipGross = db.tips.reduce((sum, tip) => sum + tip.amount, 0);
  const platformRevenue = db.tips.reduce((sum, tip) => sum + tip.platformShare, 0);
  const totalViews = db.works.reduce((sum, work) => sum + work.views, 0);

  const menu: [string, string, string][] = [
    ['/admin/works', '作品與推流', '精選作品、啟動平台推流'],
    ['/admin/users', '使用者', '查看方案、作品與收益'],
    ['/admin/payouts', '撥款審核', '處理創作者的提領申請'],
  ];

  return `<div class="grid cols-4" style="margin-bottom:20px">
    ${statCard('註冊使用者', formatNumber(db.users.length), `${creators} 位創作者 · ${paidCreators} 位付費`)}
    ${statCard('公開作品', formatNumber(published), `共 ${formatNumber(db.works.length)} 部作品`)}
    ${statCard('平台總閱讀', formatNumber(totalViews), `${formatNumber(db.chapters.length)} 個章節`)}
    ${statCard('待審提領', formatMoney(pendingTotal), `${pending.length} 筆申請`, pending.length > 0 ? 'err' : 'ok')}
    ${statCard('讀者打賞總額', formatMoney(tipGross), '平台抽成 10%', 'gold')}
    ${statCard('平台分潤收入', formatMoney(platformRevenue), '來自讀者打賞')}
    ${statCard('進行中推流', String(activePromotions), '檔活動')}
    ${statCard('留言互動', formatNumber(db.comments.length), '則讀者留言')}
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

export interface AdminWorksOptions {
  db: Database;
  works: Work[];
  promotedIds: Set<string>;
  csrfToken: string;
}

export function adminWorksPage(options: AdminWorksOptions): string {
  const { db } = options;
  const rows = options.works
    .map((work) => {
      const creator = db.users.find((user) => user.id === work.creatorId);
      const active = options.promotedIds.has(work.id);
      return `<tr>
      <td>
        <b><a href="${workHref(work)}">${escapeHtml(work.title)}</a></b>
        <div class="inline-note">${escapeHtml(creator?.name ?? '未知')} ${planBadge(creator)}</div>
      </td>
      <td>${typeBadge(work)}<div style="margin-top:3px">${statusBadge(work)}</div></td>
      <td>${work.published ? '<span class="badge ok">公開</span>' : '<span class="badge err">草稿</span>'}</td>
      <td class="num">${formatNumber(work.views)}</td>
      <td class="num">${formatMoney(tipTotal(db, work.id))}</td>
      <td>${work.featured ? '<span class="badge gold">精選</span>' : '<span class="badge muted">否</span>'}</td>
      <td>${active ? '<span class="badge pro">推流中</span>' : '<span class="badge muted">無</span>'}</td>
      <td><div class="actions">
        <form method="post" action="/admin/works/${encodeURIComponent(work.id)}/feature" style="margin:0">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <button class="btn ghost small" type="submit">${work.featured ? '取消精選' : '設為精選'}</button>
        </form>
        <form method="post" action="/admin/works/${encodeURIComponent(work.id)}/promote" style="margin:0">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <button class="btn gold small" type="submit">平台推流 14 天</button>
        </form>
        <a class="btn ghost small" href="/studio/works/${encodeURIComponent(work.id)}">管理</a>
      </div></td>
    </tr>`;
    })
    .join('');

  return `<p class="inline-note" style="margin-bottom:12px">「編輯精選」會在推薦排序中加權；「平台推流」會直接建立 14 天曝光，不限定帳號方案。</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>作品</th><th>類型／狀態</th><th>公開</th><th class="num">閱讀</th><th class="num">打賞</th><th>精選</th><th>推流</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export interface AdminUsersOptions {
  db: Database;
  users: User[];
}

export function adminUsersPage(options: AdminUsersOptions): string {
  const { db } = options;
  const rows = options.users
    .map((user) => {
      const works = db.works.filter((work) => work.creatorId === user.id);
      const views = works.reduce((sum, work) => sum + work.views, 0);
      const earned = db.earnings
        .filter((entry) => entry.creatorId === user.id)
        .reduce((sum, entry) => sum + entry.amount, 0);
      return `<tr>
      <td><b>${escapeHtml(user.name)}</b> ${planBadge(user)}<div class="inline-note">@${escapeHtml(user.username)} · ${escapeHtml(user.email)}</div></td>
      <td>${user.role === 'admin' ? '<span class="badge info">平台管理員</span>' : '<span class="badge">創作者</span>'}</td>
      <td>${PLAN_LABELS[user.plan]}</td>
      <td class="num">${works.length}</td>
      <td class="num">${formatNumber(views)}</td>
      <td class="num">${formatMoney(earned)}</td>
      <td>${formatDate(user.createdAt)}</td>
    </tr>`;
    })
    .join('');

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>使用者</th><th>角色</th><th>方案</th><th class="num">作品</th><th class="num">總閱讀</th><th class="num">累計收益</th><th>註冊</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export interface AdminPayoutsOptions {
  db: Database;
  pending: Withdrawal[];
  history: Withdrawal[];
  csrfToken: string;
}

export function adminPayoutsPage(options: AdminPayoutsOptions): string {
  const { db } = options;
  const nameOf = (id: string): string => db.users.find((user) => user.id === id)?.name ?? id;

  const pendingRows = options.pending.length === 0
    ? '<tr><td colspan="5" class="muted">目前沒有待審核的提領申請。</td></tr>'
    : options.pending
        .map(
          (item) => `<tr>
        <td>${escapeHtml(nameOf(item.creatorId))}</td>
        <td class="num">${formatMoney(item.amount)}</td>
        <td>${formatDateTime(item.requestedAt)}</td>
        <td class="muted" style="font-size:12px">${escapeHtml(item.note)}</td>
        <td><div class="actions">
          <form method="post" action="/admin/payouts/${encodeURIComponent(item.id)}" style="margin:0" data-confirm="確定已撥款 ${formatMoney(item.amount)} 給 ${escapeHtml(nameOf(item.creatorId))} 嗎？">
            <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
            <input type="hidden" name="status" value="paid">
            <button class="btn small" type="submit">標記已撥款</button>
          </form>
          <form method="post" action="/admin/payouts/${encodeURIComponent(item.id)}" style="margin:0" data-confirm="確定要退回這筆申請嗎？金額會回到創作者的可提領餘額。">
            <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
            <input type="hidden" name="status" value="rejected">
            <button class="btn danger small" type="submit">退回</button>
          </form>
        </div></td>
      </tr>`,
        )
        .join('');

  const historyRows = options.history.length === 0
    ? '<tr><td colspan="5" class="muted">還沒有已處理的申請。</td></tr>'
    : options.history
        .map(
          (item) => `<tr>
        <td>${escapeHtml(nameOf(item.creatorId))}</td>
        <td class="num">${formatMoney(item.amount)}</td>
        <td><span class="badge ${item.status === 'paid' ? 'ok' : 'err'}">${WITHDRAWAL_STATUS_LABELS[item.status]}</span></td>
        <td>${formatDateTime(item.requestedAt)}</td>
        <td>${item.processedAt === null ? '—' : formatDateTime(item.processedAt)}</td>
      </tr>`,
        )
        .join('');

  return `<div class="grid cols-3" style="margin-bottom:20px">
    ${statCard('待審核', String(options.pending.length), '筆', options.pending.length > 0 ? 'err' : 'ok')}
    ${statCard('待撥款金額', formatMoney(options.pending.reduce((sum, item) => sum + item.amount, 0)), 'NT$', 'gold')}
    ${statCard('已撥款總額', formatMoney(options.history.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0)), '歷史累計')}
  </div>
  <div class="card">
    <h2>待審核提領</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>創作者</th><th class="num">金額</th><th>申請時間</th><th>備註</th><th>操作</th></tr></thead>
        <tbody>${pendingRows}</tbody>
      </table>
    </div>
  </div>
  <div class="card">
    <h2>處理紀錄</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>創作者</th><th class="num">金額</th><th>狀態</th><th>申請時間</th><th>處理時間</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>
  </div>`;
}
