import type { User } from '../../types.js';
import { PLAN_LABELS, REVENUE_RULES, ROLE_LABELS } from '../../types.js';
import type { Errors } from '../../core/validate.js';
import { escapeHtml, formatDate, formatMoney, formatNumber } from '../../util/html.js';
import { planBadge, statCard } from '../components.js';

export interface ProfilePageOptions {
  user: User;
  csrfToken: string;
  errors: Errors;
  values: Record<string, string>;
  totals: { works: number; views: number; earned: number };
}

export function profilePage(options: ProfilePageOptions): string {
  const { user } = options;
  const err = (name: string): string =>
    options.errors[name] === undefined ? '' : `<span class="error">${escapeHtml(options.errors[name])}</span>`;
  const value = (name: string): string => escapeHtml(options.values[name] ?? '');

  const summary = Object.keys(options.errors).length === 0
    ? ''
    : `<div class="alert alert-error" role="alert">${escapeHtml(Object.values(options.errors).join('　'))}</div>`;

  const upgrade = user.plan === 'free'
    ? `<form method="post" action="/account/plan" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <input type="hidden" name="plan" value="pro">
        <button class="btn gold" type="submit" data-confirm="這會把帳號升級為付費方案（示範平台不會真的扣款）。確定嗎？">升級付費帳號</button>
      </form>`
    : '<span class="badge pro">目前方案</span>';

  const downgrade = user.plan === 'pro'
    ? `<form method="post" action="/account/plan" style="margin:0">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <input type="hidden" name="plan" value="free">
        <button class="btn ghost" type="submit" data-confirm="降級後新作品將不再產生閱讀收益、收取打賞或自動推流，已累積的餘額仍可提領。確定要降級嗎？">降級為免費帳號</button>
      </form>`
    : '<span class="badge muted">目前方案</span>';

  return `<div class="two-col">
  <div>
    ${summary}
    <div class="card">
      <h2>個人資料</h2>
      <form method="post" action="/profile" class="stack" style="max-width:none">
        <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
        <div class="form-grid">
          <div class="field">
            <label for="name">筆名</label>
            <input id="name" type="text" name="name" value="${value('name')}" maxlength="20" required>
            ${err('name')}
          </div>
          <div class="field">
            <label for="avatar">頭像符號</label>
            <input id="avatar" type="text" name="avatar" value="${value('avatar')}" maxlength="8">
            <span class="hint">一個 emoji 或 1～2 個字元。</span>
            ${err('avatar')}
          </div>
        </div>
        <div class="field">
          <label for="email">電子郵件</label>
          <input id="email" type="email" name="email" value="${value('email')}" maxlength="60" required>
          ${err('email')}
        </div>
        <div class="field">
          <label for="bio">作者簡介</label>
          <textarea id="bio" name="bio" maxlength="300" placeholder="介紹你的創作風格、正在連載的作品，或想對讀者說的話。">${value('bio')}</textarea>
          ${err('bio')}
        </div>
        <div><button class="btn" type="submit">儲存個人資料</button></div>
      </form>
    </div>

    <div class="card" id="plans">
      <h2>帳號方案</h2>
      <p class="muted" style="font-size:13px">免費帳號可以投稿；付費帳號可獲得閱讀收益、讀者打賞與自動系統推流。示範平台不串接真實金流，切換方案不會扣款。</p>
      <div class="grid cols-2">
        <div class="plan-card${user.plan === 'free' ? ' current' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center"><h3>免費帳號</h3>${user.plan === 'free' ? '<span class="badge">使用中</span>' : ''}</div>
          <div class="plan-price">NT$ 0 <small>永久</small></div>
          <ul class="plan-features">
            <li>上傳小說與漫畫</li>
            <li>無限章節與留言</li>
            <li>作品公開展示</li>
            <li class="muted">不含閱讀收益、打賞與推流</li>
          </ul>
          ${user.plan === 'free' ? '<span class="badge muted">目前方案</span>' : downgrade}
        </div>
        <div class="plan-card pro${user.plan === 'pro' ? ' current' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center"><h3>付費帳號 <span class="badge pro">PRO</span></h3>${user.plan === 'pro' ? '<span class="badge pro">使用中</span>' : ''}</div>
          <div class="plan-price">NT$ ${REVENUE_RULES.proMonthlyPrice} <small>／月（示範）</small></div>
          <ul class="plan-features">
            <li>閱讀收益 NT$ ${REVENUE_RULES.viewReward}／次</li>
            <li>打賞分潤 ${Math.round(REVENUE_RULES.creatorTipShare * 100)}%</li>
            <li>公開作品自動推流 ${REVENUE_RULES.promotionDays} 天</li>
            <li>收益明細與提領</li>
          </ul>
          ${upgrade}
        </div>
      </div>
    </div>
  </div>

  <aside class="side-stack">
    <div class="card" style="text-align:center">
      <div class="creator-avatar" style="margin:0 auto 12px">${escapeHtml(user.avatar)}</div>
      <h2 style="justify-content:center">${escapeHtml(user.name)} ${planBadge(user)}</h2>
      <p class="inline-note">@${escapeHtml(user.username)}</p>
      <p class="muted" style="font-size:13px">${escapeHtml(user.bio === '' ? '還沒有填寫作者簡介。' : user.bio)}</p>
      <div style="display:grid;gap:8px;text-align:left;margin-top:14px">
        ${statCard('作品數', formatNumber(options.totals.works), '部')}
        ${statCard('總閱讀', formatNumber(options.totals.views), '次')}
        ${statCard('累計收益', formatMoney(options.totals.earned), user.plan === 'pro' ? 'NT$' : '升級後開通', 'gold')}
      </div>
    </div>
    <div class="card">
      <h2>帳號資訊</h2>
      <div class="inline-note" style="display:grid;gap:6px">
        <div>角色：${ROLE_LABELS[user.role]}</div>
        <div>方案：${PLAN_LABELS[user.plan]}</div>
        <div>註冊：${formatDate(user.createdAt)}</div>
        <div>升級：${user.planSince === null ? '—' : formatDate(user.planSince)}</div>
        <div>帳號 ID：<span class="mono">${escapeHtml(user.id)}</span></div>
      </div>
    </div>
    <div class="card">
      <h2>作品連結</h2>
      <p class="muted" style="font-size:13px">你的公開作者頁可以分享給讀者。</p>
      <a class="btn ghost" href="/creators/${encodeURIComponent(user.id)}">查看我的作者頁</a>
    </div>
  </aside>
</div>`;
}
