import type { User } from '../../types.js';
import { ROLE_LABELS } from '../../types.js';
import type { Errors } from '../../core/validate.js';
import { escapeHtml, formatMoney } from '../../util/html.js';

export interface ProfilePageOptions {
  user: User;
  errors: Errors;
  values: Record<string, string>;
  csrfToken: string;
  stats: { jobs: number; applications: number };
}

export function profilePage(options: ProfilePageOptions): string {
  const { user, errors } = options;
  const summary = Object.keys(errors).length === 0
    ? ''
    : `<div class="alert alert-error" role="alert">${escapeHtml(Object.values(errors).join('　'))}</div>`;
  const error = (name: string): string => errors[name] === undefined
    ? ''
    : `<span class="error">${escapeHtml(errors[name])}</span>`;
  const value = (name: string): string => escapeHtml(options.values[name] ?? '');
  const isEmployer = user.role === 'employer';

  return `<div class="two-col">
  <section class="card">
    <h2>個人資料</h2>
    <p class="inline-note" style="margin-top:-6px">這些資訊會顯示在你的企業頁面或應徵對話中。</p>
    ${summary}
    <form method="post" action="/profile" class="stack" style="max-width:none">
      <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
      <div class="form-grid">
        <div class="field">
          <label for="name">姓名／聯絡人</label>
          <input id="name" type="text" name="name" value="${value('name')}" maxlength="30" required>
          ${error('name')}
        </div>
        <div class="field">
          <label for="email">電子郵件</label>
          <input id="email" type="email" name="email" value="${value('email')}" maxlength="60" required>
          ${error('email')}
        </div>
        <div class="field">
          <label for="avatar">頭像符號</label>
          <input id="avatar" type="text" name="avatar" value="${value('avatar')}" maxlength="8">
          ${error('avatar')}
        </div>
        ${isEmployer ? `<div class="field">
          <label for="company">公司名稱</label>
          <input id="company" type="text" name="company" value="${value('company')}" maxlength="40" required>
          ${error('company')}
        </div>` : ''}
      </div>
      <div class="field">
        <label for="bio">自我介紹／企業簡介</label>
        <textarea id="bio" name="bio" maxlength="400" style="min-height:120px">${value('bio')}</textarea>
        ${error('bio')}
      </div>
      <button class="btn" type="submit">儲存變更</button>
    </form>
  </section>

  <div class="side-stack">
    <section class="card" style="margin:0">
      <div class="company-card">
        <span class="company-avatar">${escapeHtml(user.avatar)}</span>
        <div>
          <h3>${escapeHtml(user.name)}</h3>
          <p>${isEmployer ? escapeHtml(user.company) : '求職者'} · ${ROLE_LABELS[user.role]}</p>
          <div class="inline-note" style="margin-top:4px">@${escapeHtml(user.username)}</div>
        </div>
      </div>
      <div class="detail-meta" style="margin-bottom:0">
        <div><span class="inline-note">${isEmployer ? '刊登職缺' : '應徵職缺'}</span><div style="font-family:var(--serif);font-size:20px">${options.stats.jobs}</div></div>
        <div><span class="inline-note">${isEmployer ? '收到應徵' : '進行中對話'}</span><div style="font-family:var(--serif);font-size:20px">${options.stats.applications}</div></div>
        ${isEmployer ? `<div><span class="inline-note">錢包餘額</span><div style="font-family:var(--serif);font-size:20px">${formatMoney(user.balance)}</div></div>` : ''}
      </div>
      ${isEmployer ? '<a class="btn gold block" href="/wallet" style="margin-top:14px">管理錢包與曝光</a>' : '<a class="btn block" href="/dashboard" style="margin-top:14px">查看我的應徵</a>'}
    </section>
    <section class="card" style="margin:0">
      <h2>帳號資訊</h2>
      <div class="inline-note">角色：${ROLE_LABELS[user.role]}</div>
      <div class="inline-note">帳號：@${escapeHtml(user.username)}</div>
      <div class="inline-note">註冊時間：${escapeHtml(new Date(user.createdAt).toLocaleDateString('zh-TW'))}</div>
    </section>
  </div>
</div>`;
}
