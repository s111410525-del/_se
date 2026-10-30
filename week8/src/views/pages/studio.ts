import type { Chapter, Database, Earning, Promotion, Tip, User, Withdrawal, Work } from '../../types.js';
import {
  REVENUE_RULES,
  WITHDRAWAL_STATUS_LABELS,
  WORK_STATUSES,
  WORK_STATUS_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
} from '../../types.js';
import type { Errors } from '../../core/validate.js';
import { escapeHtml, formatDate, formatDateTime, formatMoney, formatNumber, colorIndex, truncate } from '../../util/html.js';
import { activePromotion, promotionStatsOf } from '../../services/promotion.js';
import { bookmarkCount } from '../../services/engagement.js';
import { chapterCount, wordCountOf } from '../../services/works.js';
import { tipTotal } from '../../services/ranking.js';
import { creatorLink, emptyState, statCard, statusBadge, typeBadge, workHref } from '../components.js';

export interface StudioDashboardOptions {
  db: Database;
  user: User;
  works: Work[];
  totals: {
    views: number;
    earned: number;
    available: number;
    reserved: number;
    promotionImpressions: number;
    promotionClicks: number;
  };
  recentEarnings: Earning[];
  pendingWithdrawal: Withdrawal | undefined;
}

export function studioDashboard(options: StudioDashboardOptions): string {
  const { db, user } = options;
  const promotion = promotionStatsOf(db, user.id);
  const planBanner = user.plan === 'pro'
    ? `<div class="plan-banner">
        <div><h2>付費帳號啟用中 <span class="badge pro">PRO</span></h2><p>作品依閱讀與打賞產生收益，公開後自動獲得系統推流。${user.planSince === null ? '' : `方案自 ${formatDate(user.planSince)} 起。`}</p></div>
        <a class="btn gold" href="/studio/earnings">查看收益</a>
      </div>`
    : `<div class="plan-banner free">
        <div><h2>你目前是免費帳號</h2><p>可以盡情投稿與經營讀者，但閱讀收益、讀者打賞與系統推流需要升級付費帳號（示範月費 NT$ ${REVENUE_RULES.proMonthlyPrice}）。</p></div>
        <a class="btn gold" href="/profile#plans">升級付費帳號</a>
      </div>`;

  const workRows = options.works.length === 0
    ? `<tr><td colspan="6">${emptyState('你還沒有作品。發表第一部小說或漫畫吧。', { href: '/studio/works/new', label: '發表作品' })}</td></tr>`
    : options.works
        .map((work) => {
          const promo = activePromotion(db, work.id);
          return `<tr>
        <td>
          <b><a href="${workHref(work)}">${escapeHtml(work.title)}</a></b>
          <div class="inline-note">${WORK_TYPE_LABELS[work.type]} · ${work.published ? '已公開' : '未公開'}</div>
        </td>
        <td>${statusBadge(work)}</td>
        <td class="num">${formatNumber(chapterCount(db, work.id))}</td>
        <td class="num">${formatNumber(work.views)}</td>
        <td class="num">${formatMoney(tipTotal(db, work.id))}</td>
        <td>${promo === undefined ? '<span class="badge muted">無推流</span>' : `<span class="badge pro">推流至 ${formatDate(promo.expiresAt)}</span>`}</td>
        <td><div class="actions"><a class="btn ghost small" href="/studio/works/${encodeURIComponent(work.id)}">管理</a><a class="btn ghost small" href="${workHref(work)}">檢視</a></div></td>
      </tr>`;
        })
        .join('');

  const earningsRows = options.recentEarnings.length === 0
    ? '<tr><td colspan="4" class="muted">還沒有收益紀錄。</td></tr>'
    : options.recentEarnings
        .map((entry) => {
          const work = entry.workId === null ? undefined : db.works.find((item) => item.id === entry.workId);
          return `<tr>
        <td>${entry.kind === 'tip' ? '<span class="badge gold">打賞</span>' : '<span class="badge info">閱讀</span>'}</td>
        <td>${work === undefined ? '—' : `<a href="${workHref(work)}">${escapeHtml(truncate(work.title, 18))}</a>`}</td>
        <td class="num">${formatMoney(entry.amount)}</td>
        <td>${formatDateTime(entry.createdAt)}</td>
      </tr>`;
        })
        .join('');

  const pending = options.pendingWithdrawal === undefined
    ? ''
    : `<div class="notice">有一筆 ${formatMoney(options.pendingWithdrawal.amount)} 的提領申請正在審核中（${formatDate(options.pendingWithdrawal.requestedAt)} 提出）。</div>`;

  return `${planBanner}
${pending}
<div class="grid cols-4" style="margin-bottom:20px">
  ${statCard('作品數', formatNumber(options.works.length), `共 ${formatNumber(options.totals.views)} 次閱讀`)}
  ${statCard('累計收益', formatMoney(options.totals.earned), user.plan === 'pro' ? '閱讀 + 打賞分潤' : '升級後開通', user.plan === 'pro' ? 'gold' : '')}
  ${statCard('可提領餘額', formatMoney(options.totals.available), `保留中 ${formatMoney(options.totals.reserved)}`, 'ok')}
  ${statCard('推流曝光', formatNumber(promotion.impressions), `${formatNumber(promotion.clicks)} 次點擊 · CTR ${promotion.clickRate}%`)}
</div>

<div class="section-head" style="margin-top:0">
  <div><h2>我的作品</h2><p>管理章節、公開狀態與推流。</p></div>
  <a class="btn" href="/studio/works/new">＋ 發表作品</a>
</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>作品</th><th>狀態</th><th class="num">章節</th><th class="num">閱讀</th><th class="num">打賞</th><th>推流</th><th>操作</th></tr></thead>
    <tbody>${workRows}</tbody>
  </table>
</div>

<div class="two-col" style="margin-top:20px">
  <div class="card">
    <h2>最近收益</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>類型</th><th>作品</th><th class="num">金額</th><th>時間</th></tr></thead>
        <tbody>${earningsRows}</tbody>
      </table>
    </div>
    <div style="margin-top:12px"><a class="btn ghost small" href="/studio/earnings">完整收益明細</a></div>
  </div>
  <div class="card">
    <h2>推流成效</h2>
    <p class="muted" style="font-size:13px">系統推流會把作品放進首頁推流區，並在推薦排序中加權。曝光與點擊數據每檔活動分別累計。</p>
    <div class="grid cols-3">
      ${statCard('進行中', String(promotion.active), '檔推流')}
      ${statCard('曝光', formatNumber(promotion.impressions), '次')}
      ${statCard('點擊率', `${promotion.clickRate}%`, `${formatNumber(promotion.clicks)} 次點擊`)}
    </div>
    ${user.plan === 'pro'
      ? '<p class="inline-note" style="margin-top:10px">作品公開後會自動建立 7 天推流；在作品管理頁可再啟動新的一檔。</p>'
      : '<div class="notice" style="margin-top:12px">升級付費帳號後，公開作品會自動獲得系統推流。</div>'}
  </div>
</div>`;
}

export interface WorkFormOptions {
  mode: 'create' | 'edit';
  work: Work | undefined;
  values: Record<string, string>;
  errors: Errors;
  csrfToken: string;
}

export function workFormPage(options: WorkFormOptions): string {
  const editing = options.mode === 'edit' && options.work !== undefined;
  const action = editing ? `/studio/works/${encodeURIComponent(options.work?.id ?? '')}` : '/studio/works';
  const err = (name: string): string =>
    options.errors[name] === undefined ? '' : `<span class="error">${escapeHtml(options.errors[name])}</span>`;
  const value = (name: string): string => escapeHtml(options.values[name] ?? '');

  const typeOptions = WORK_TYPES.map(
    (type) => `<option value="${type}"${options.values['type'] === type ? ' selected' : ''}>${WORK_TYPE_LABELS[type]}</option>`,
  ).join('');
  const statusOptions = WORK_STATUSES.map(
    (status) => `<option value="${status}"${options.values['status'] === status ? ' selected' : ''}>${WORK_STATUS_LABELS[status]}</option>`,
  ).join('');

  return `<div class="card" style="max-width:860px">
  <h2>${editing ? '編輯作品' : '發表新作品'}</h2>
  <form method="post" action="${action}" class="stack" style="max-width:none">
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <div class="field">
      <label for="title">作品名稱</label>
      <input id="title" type="text" name="title" value="${value('title')}" maxlength="60" required autofocus>
      ${err('title')}
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="type">類型</label>
        <select id="type" name="type">${typeOptions}</select>
        ${err('type')}
      </div>
      <div class="field">
        <label for="status">連載狀態</label>
        <select id="status" name="status">${statusOptions}</select>
        ${err('status')}
      </div>
      <div class="field">
        <label for="cover">封面符號</label>
        <input id="cover" type="text" name="cover" value="${value('cover')}" maxlength="8" placeholder="例如 🌙">
        <span class="hint">貼上一個 emoji 或 1～2 個字元，作為作品封面。</span>
        ${err('cover')}
      </div>
    </div>
    <div class="field">
      <label for="tags">標籤</label>
      <input id="tags" type="text" name="tags" value="${value('tags')}" maxlength="100" placeholder="奇幻、懸疑、療癒">
      <span class="hint">以逗號、空白或頓號分隔，最多 5 個。</span>
      ${err('tags')}
    </div>
    <div class="field">
      <label for="synopsis">作品簡介</label>
      <textarea id="synopsis" name="synopsis" maxlength="500" required placeholder="用幾句話讓讀者知道這個故事。">${value('synopsis')}</textarea>
      ${err('synopsis')}
    </div>
    <div class="field">
      <label class="check-line"><input type="checkbox" name="published" value="1"${options.values['published'] === '1' ? ' checked' : ''}> 立即公開（未勾選則存為草稿，只有你看得到）</label>
    </div>
    <div class="form-actions">
      <button class="btn" type="submit">${editing ? '儲存變更' : '建立作品'}</button>
      <a class="btn ghost" href="${editing ? `/studio/works/${encodeURIComponent(options.work?.id ?? '')}` : '/studio'}">取消</a>
    </div>
  </form>
</div>`;
}

export interface WorkManageOptions {
  db: Database;
  work: Work;
  chapters: Chapter[];
  tips: Tip[];
  promotion: Promotion | undefined;
  csrfToken: string;
}

export function workManagePage(options: WorkManageOptions): string {
  const { db, work } = options;
  const creator = db.users.find((user) => user.id === work.creatorId);
  const isPro = creator?.plan === 'pro';

  const chapterRows = options.chapters.length === 0
    ? `<tr><td colspan="4">${emptyState('還沒有章節。新增第一章，讓讀者開始追更。', { href: `/studio/works/${encodeURIComponent(work.id)}/chapters/new`, label: '新增章節' })}</td></tr>`
    : options.chapters
        .map(
          (chapter) => `<tr>
        <td class="num">${chapter.order}</td>
        <td><b>${escapeHtml(chapter.title)}</b><div class="inline-note">${formatDate(chapter.updatedAt)}</div></td>
        <td class="num">${formatNumber(chapter.views)}</td>
        <td><div class="actions">
          <a class="btn ghost small" href="${workHref(work)}/chapters/${encodeURIComponent(chapter.id)}">閱讀</a>
          <a class="btn ghost small" href="/studio/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(chapter.id)}/edit">編輯</a>
          <form method="post" action="/studio/works/${encodeURIComponent(work.id)}/chapters/${encodeURIComponent(chapter.id)}/delete" style="margin:0">
            <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
            <button class="btn danger small" type="submit" data-confirm="確定要刪除這個章節嗎？刪除後無法復原。">刪除</button>
          </form>
        </div></td>
      </tr>`,
        )
        .join('');

  const promotionBlock = !isPro
    ? `<div class="notice">免費帳號不會自動推流。升級付費帳號後，公開作品可獲得 7 天系統推流。</div>
      <a class="btn gold" href="/profile#plans">升級付費帳號</a>`
    : options.promotion === undefined
      ? `<p class="muted" style="font-size:13px">這部作品目前沒有進行中的推流。啟動後會出現在首頁推流區 7 天。</p>
        <form method="post" action="/studio/works/${encodeURIComponent(work.id)}/promote" style="margin:0">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <button class="btn gold" type="submit">啟動系統推流</button>
        </form>`
      : `<p class="muted" style="font-size:13px">推流至 ${formatDateTime(options.promotion.expiresAt)}（${options.promotion.source === 'admin' ? '平台推薦' : '付費方案'}）。</p>
        <div class="grid cols-3">
          ${statCard('曝光', formatNumber(options.promotion.impressions), '次')}
          ${statCard('點擊', formatNumber(options.promotion.clicks), '次')}
          ${statCard('點擊率', `${options.promotion.impressions === 0 ? 0 : Math.round((options.promotion.clicks / options.promotion.impressions) * 1000) / 10}%`, '')}
        </div>`;

  const tipRows = options.tips.length === 0
    ? '<tr><td colspan="4" class="muted">還沒有讀者打賞。</td></tr>'
    : options.tips
        .map((tip) => {
          const reader = db.users.find((user) => user.id === tip.fromUserId);
          return `<tr>
        <td>${escapeHtml(reader?.name ?? '匿名讀者')}</td>
        <td class="num">${formatMoney(tip.amount)}</td>
        <td class="num">${formatMoney(tip.creatorShare)}</td>
        <td>${formatDateTime(tip.createdAt)}${tip.message === '' ? '' : `<div class="inline-note">「${escapeHtml(tip.message)}」</div>`}</td>
      </tr>`;
        })
        .join('');

  return `<div class="card">
  <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
    <div class="work-cover-lg color-${colorIndex(work.id)}" style="width:110px;min-height:140px;flex:none">
      <span class="cover-emoji" style="font-size:42px">${escapeHtml(work.cover)}</span>
    </div>
    <div style="flex:1;min-width:240px">
      <div class="badge-row">${statusBadge(work)}${typeBadge(work)}${work.featured ? '<span class="badge gold">編輯精選</span>' : ''}${work.published ? '' : '<span class="badge err">未公開</span>'}</div>
      <h2 style="margin:4px 0 6px">${escapeHtml(work.title)}</h2>
      <div class="inline-note">${creatorLink(db, work)} · ${WORK_TYPE_LABELS[work.type]} · ${chapterCount(db, work.id)} 章 · ${formatNumber(wordCountOf(db, work.id))} 字 · ${formatNumber(bookmarkCount(db, work.id))} 收藏</div>
      <p class="muted" style="font-size:13px;margin-top:8px">${escapeHtml(truncate(work.synopsis, 160))}</p>
      <div class="actions">
        <a class="btn" href="/studio/works/${encodeURIComponent(work.id)}/chapters/new">＋ 新增章節</a>
        <a class="btn ghost" href="/studio/works/${encodeURIComponent(work.id)}/edit">編輯作品</a>
        <a class="btn ghost" href="${workHref(work)}">公開頁面</a>
        <form method="post" action="/studio/works/${encodeURIComponent(work.id)}/toggle" style="margin:0"${work.published ? ' data-confirm="確定要取消公開嗎？讀者將看不到這部作品。"' : ''}>
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <button class="btn ghost" type="submit">${work.published ? '取消公開' : '公開作品'}</button>
        </form>
      </div>
    </div>
  </div>
</div>

<div class="two-col">
  <div>
    <div class="card">
      <h2>章節管理</h2>
      <div class="table-wrap" style="border:0">
        <table>
          <thead><tr><th class="num">#</th><th>章節</th><th class="num">閱讀</th><th>操作</th></tr></thead>
          <tbody>${chapterRows}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h2>讀者打賞</h2>
      <div class="table-wrap" style="border:0">
        <table>
          <thead><tr><th>讀者</th><th class="num">打賞</th><th class="num">分潤</th><th>時間／留言</th></tr></thead>
          <tbody>${tipRows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <aside class="side-stack">
    <div class="card">
      <h2>系統推流</h2>
      ${promotionBlock}
    </div>
    <div class="card">
      <h2>作品數據</h2>
      <div class="grid cols-2">
        ${statCard('總閱讀', formatNumber(work.views), '次')}
        ${statCard('累計打賞', formatMoney(tipTotal(db, work.id)), 'NT$', 'gold')}
        ${statCard('字數', formatNumber(wordCountOf(db, work.id)), '字')}
        ${statCard('留言', String(db.comments.filter((comment) => comment.workId === work.id).length), '則')}
      </div>
    </div>
    <div class="card">
      <h2>公開資訊</h2>
      <p class="inline-note">建立於 ${formatDateTime(work.createdAt)}<br>最近更新 ${formatDateTime(work.updatedAt)}</p>
      <p class="inline-note">作品 ID：<span class="mono">${escapeHtml(work.id)}</span></p>
    </div>
  </aside>
</div>`;
}

export interface ChapterFormOptions {
  mode: 'create' | 'edit';
  work: Work;
  chapter: Chapter | undefined;
  values: Record<string, string>;
  errors: Errors;
  csrfToken: string;
}

export function chapterFormPage(options: ChapterFormOptions): string {
  const editing = options.mode === 'edit' && options.chapter !== undefined;
  const action = editing
    ? `/studio/works/${encodeURIComponent(options.work.id)}/chapters/${encodeURIComponent(options.chapter?.id ?? '')}`
    : `/studio/works/${encodeURIComponent(options.work.id)}/chapters`;
  const err = (name: string): string =>
    options.errors[name] === undefined ? '' : `<span class="error">${escapeHtml(options.errors[name])}</span>`;

  return `<div class="card" style="max-width:900px">
  <h2>${editing ? '編輯章節' : '新增章節'}　<span class="badge">${escapeHtml(options.work.title)}</span></h2>
  <form method="post" action="${action}" class="stack" style="max-width:none">
    <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
    <div class="field">
      <label for="title">章節標題</label>
      <input id="title" type="text" name="title" value="${escapeHtml(options.values['title'] ?? '')}" maxlength="80" required autofocus>
      ${err('title')}
    </div>
    <div class="field">
      <label for="content">${options.work.type === 'novel' ? '章節正文' : '漫畫分鏡／文字說明'}</label>
      <textarea id="content" class="tall" name="content" maxlength="20000" required placeholder="${options.work.type === 'novel' ? '在這裡寫下故事。空行會變成段落。' : '描述每一格畫面與對白；若有圖片網址，會在閱讀頁顯示圖片。'}">${escapeHtml(options.values['content'] ?? '')}</textarea>
      <span class="hint">最多 20,000 字。內容會以純文字保存，不會執行 HTML。</span>
      ${err('content')}
    </div>
    <div class="field">
      <label for="imageUrls">圖片網址（選填）</label>
      <textarea id="imageUrls" name="imageUrls" style="min-height:90px" placeholder="https://example.com/page1.jpg">${escapeHtml(options.values['imageUrls'] ?? '')}</textarea>
      <span class="hint">一行一個 http/https 網址，主要供漫畫使用。沒有圖片時，漫畫會以文字分鏡呈現。</span>
      ${err('imageUrls')}
    </div>
    <div class="form-actions">
      <button class="btn" type="submit">${editing ? '儲存章節' : '發布章節'}</button>
      <a class="btn ghost" href="/studio/works/${encodeURIComponent(options.work.id)}">取消</a>
    </div>
  </form>
</div>`;
}

export interface EarningsPageOptions {
  db: Database;
  user: User;
  earnings: Earning[];
  withdrawals: Withdrawal[];
  totals: { earned: number; view: number; tip: number; reserved: number; available: number };
  pending: Withdrawal | undefined;
  csrfToken: string;
}

export function earningsPage(options: EarningsPageOptions): string {
  const { db, user } = options;
  const pro = user.plan === 'pro';
  const rows = options.earnings.length === 0
    ? '<tr><td colspan="5" class="muted">還沒有收益紀錄。付費作品被閱讀或收到打賞後，會出現在這裡。</td></tr>'
    : options.earnings
        .map((entry) => {
          const work = entry.workId === null ? undefined : db.works.find((item) => item.id === entry.workId);
          return `<tr>
        <td>${formatDateTime(entry.createdAt)}</td>
        <td>${entry.kind === 'tip' ? '<span class="badge gold">打賞分潤</span>' : '<span class="badge info">閱讀收益</span>'}</td>
        <td>${work === undefined ? '—' : `<a href="${workHref(work)}">${escapeHtml(work.title)}</a>`}</td>
        <td class="num">${formatMoney(entry.amount)}</td>
        <td class="muted" style="font-size:12px">${escapeHtml(entry.note)}</td>
      </tr>`;
        })
        .join('');

  const withdrawalRows = options.withdrawals.length === 0
    ? '<tr><td colspan="5" class="muted">還沒有提領紀錄。</td></tr>'
    : options.withdrawals
        .map(
          (item) => `<tr>
        <td>${formatDateTime(item.requestedAt)}</td>
        <td class="num">${formatMoney(item.amount)}</td>
        <td><span class="badge ${item.status === 'paid' ? 'ok' : item.status === 'pending' ? 'warn' : 'err'}">${WITHDRAWAL_STATUS_LABELS[item.status]}</span></td>
        <td>${item.processedAt === null ? '—' : formatDateTime(item.processedAt)}</td>
        <td class="muted" style="font-size:12px">${escapeHtml(item.note)}</td>
      </tr>`,
        )
        .join('');

  let withdrawForm: string;
  if (!pro) {
    withdrawForm = `<div class="notice">提領功能只開放給付費帳號。<a href="/profile#plans">升級方案</a></div>`;
  } else if (options.pending !== undefined) {
    withdrawForm = `<div class="notice">你有一筆 ${formatMoney(options.pending.amount)} 的申請正在審核中，平台處理後才能再提出。</div>`;
  } else if (options.totals.available < REVENUE_RULES.withdrawMin) {
    withdrawForm = `<p class="muted" style="font-size:13px">目前可提領 ${formatMoney(options.totals.available)}，滿 ${formatMoney(REVENUE_RULES.withdrawMin)} 才能申請。</p>`;
  } else {
    withdrawForm = `<form method="post" action="/studio/withdraw" class="stack" style="max-width:none">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      <div class="form-grid">
        <div class="field">
          <label for="amount">提領金額（整數，NT$）</label>
          <input id="amount" type="number" name="amount" min="${REVENUE_RULES.withdrawMin}" max="${Math.floor(options.totals.available)}" step="1" value="${Math.floor(options.totals.available)}" required>
          <span class="hint">可提領 ${formatMoney(options.totals.available)}</span>
        </div>
        <div class="field">
          <label for="note">備註（選填）</label>
          <input id="note" type="text" name="note" maxlength="100" placeholder="例如：希望月底前撥款">
        </div>
      </div>
      <div><button class="btn gold" type="submit">提出提領申請</button></div>
    </form>`;
  }

  return `<div class="grid cols-4" style="margin-bottom:20px">
  ${statCard('累計收益', formatMoney(options.totals.earned), user.plan === 'pro' ? '所有作品' : '升級後開通', 'gold')}
  ${statCard('閱讀收益', formatMoney(options.totals.view), '每閱讀 NT$ 0.02')}
  ${statCard('打賞分潤', formatMoney(options.totals.tip), '作者 90%')}
  ${statCard('可提領', formatMoney(options.totals.available), `保留中 ${formatMoney(options.totals.reserved)}`, 'ok')}
</div>

<div class="two-col">
  <div class="card">
    <h2>收益明細</h2>
    <div class="table-wrap" style="border:0">
      <table>
        <thead><tr><th>時間</th><th>類型</th><th>作品</th><th class="num">金額</th><th>說明</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <aside class="side-stack">
    <div class="card">
      <h2>申請提領</h2>
      ${withdrawForm}
    </div>
    <div class="card">
      <h2>提領紀錄</h2>
      <div class="table-wrap" style="border:0">
        <table>
          <thead><tr><th>申請時間</th><th class="num">金額</th><th>狀態</th><th>處理時間</th><th>備註</th></tr></thead>
          <tbody>${withdrawalRows}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h2>收益怎麼來？</h2>
      <ul class="plan-features" style="margin:0">
        <li>讀者每次開啟你的章節：NT$ ${REVENUE_RULES.viewReward}</li>
        <li>讀者打賞：你獲得 ${Math.round(REVENUE_RULES.creatorTipShare * 100)}%，平台 ${Math.round((1 - REVENUE_RULES.creatorTipShare) * 100)}%</li>
        <li>提領門檻：NT$ ${REVENUE_RULES.withdrawMin}</li>
        <li>示範平台不串接真實金流</li>
      </ul>
    </div>
  </aside>
</div>`;
}
