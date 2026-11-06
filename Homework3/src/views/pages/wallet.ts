import type { Job, LedgerEntry, Promotion, User } from '../../types.js';
import {
  LEDGER_KIND_LABELS,
  PROMOTION_PLANS,
  WALLET_RULES,
} from '../../types.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from '../../util/html.js';

export interface WalletPageOptions {
  user: User;
  ledger: LedgerEntry[];
  promotions: Promotion[];
  jobs: Job[];
  csrfToken: string;
}

export function walletPage(options: WalletPageOptions): string {
  const { user } = options;
  const jobTitle = (jobId: string): string =>
    options.jobs.find((job) => job.id === jobId)?.title ?? '職缺已移除';

  const presets = WALLET_RULES.topupPresets
    .map(
      (amount) =>
        `<button type="button" data-topup-amount="${amount}">${formatMoney(amount)}</button>`,
    )
    .join('');

  const ledgerRows = options.ledger.length === 0
    ? '<tr><td colspan="5" class="muted">還沒有任何錢包紀錄。</td></tr>'
    : options.ledger
        .map(
          (entry) => `<tr>
        <td>${escapeHtml(LEDGER_KIND_LABELS[entry.kind])}</td>
        <td>${escapeHtml(entry.note)}</td>
        <td class="num" style="color:${entry.amount >= 0 ? 'var(--ok)' : 'var(--err)'}">${entry.amount >= 0 ? '+' : ''}${formatMoney(entry.amount)}</td>
        <td class="num">${formatMoney(entry.balanceAfter)}</td>
        <td>${escapeHtml(formatDateTime(entry.createdAt))}</td>
      </tr>`,
        )
        .join('');

  const promotionRows = options.promotions.length === 0
    ? '<tr><td colspan="6" class="muted">目前沒有進行中的曝光。</td></tr>'
    : options.promotions
        .map(
          (promotion) => `<tr>
        <td>${escapeHtml(jobTitle(promotion.jobId))}</td>
        <td><span class="badge promo">${promotion.source === 'admin' ? '平台贈送' : '錢包購買'}</span></td>
        <td class="num">${formatNumber(promotion.days)} 天</td>
        <td class="num">${formatNumber(promotion.impressions)}</td>
        <td class="num">${formatNumber(promotion.clicks)}</td>
        <td>${escapeHtml(formatDate(promotion.expiresAt))} 到期</td>
      </tr>`,
        )
        .join('');

  return `<div class="balance-card">
    <div class="label">WALLET BALANCE</div>
    <div class="amount">${formatMoney(user.balance)}</div>
    <p>這筆餘額可用來購買職缺曝光。本專案為模擬金流，儲值不會產生實際扣款。</p>
  </div>

  <div class="two-col">
    <div>
      <section class="card">
        <h2>儲值曝光金</h2>
        <p class="inline-note" style="margin-top:-6px">單次儲值 ${formatMoney(WALLET_RULES.topupMin)}～${formatMoney(WALLET_RULES.topupMax)}。</p>
        <form method="post" action="/wallet/topup" class="stack" style="max-width:none">
          <input type="hidden" name="_csrf" value="${escapeHtml(options.csrfToken)}">
          <div class="field">
            <label for="topup-amount">儲值金額（元）</label>
            <input id="topup-amount" type="number" name="amount" min="${WALLET_RULES.topupMin}" max="${WALLET_RULES.topupMax}" step="100" required placeholder="例如：600">
            <div class="preset-row" style="margin-top:6px">${presets}</div>
          </div>
          <div class="field">
            <label for="method">付款方式（模擬）</label>
            <select id="method" name="method">
              <option value="信用卡（模擬）">信用卡（模擬）</option>
              <option value="ATM 轉帳（模擬）">ATM 轉帳（模擬）</option>
              <option value="超商代碼（模擬）">超商代碼（模擬）</option>
            </select>
          </div>
          <button class="btn gold" type="submit">確認儲值</button>
        </form>
      </section>

      <section class="card">
        <h2>錢包紀錄</h2>
        <div class="table-wrap" style="border:0">
          <table>
            <thead><tr><th>類型</th><th>說明</th><th class="num">金額</th><th class="num">餘額</th><th>時間</th></tr></thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="side-stack">
      <section class="card" style="margin:0">
        <h2>曝光方案</h2>
        <div class="plan-grid">
          ${PROMOTION_PLANS.map(
            (plan) =>
              `<div class="plan-card"><h3>${escapeHtml(plan.label)}</h3><div class="price">${formatMoney(plan.price)}</div><div class="hint">${escapeHtml(plan.hint)}</div></div>`,
          ).join('')}
        </div>
        <p class="inline-note" style="margin:12px 0 0">到徵才中心選擇職缺後即可購買曝光。</p>
        <a class="btn block" href="/employer" style="margin-top:10px">前往徵才中心</a>
      </section>

      <section class="card" style="margin:0">
        <h2>進行中的曝光</h2>
        <div class="table-wrap" style="border:0">
          <table style="min-width:0">
            <thead><tr><th>職缺</th><th>來源</th><th class="num">天數</th><th class="num">曝光</th><th class="num">點擊</th><th>到期</th></tr></thead>
            <tbody>${promotionRows}</tbody>
          </table>
        </div>
      </section>
    </div>
  </div>`;
}
