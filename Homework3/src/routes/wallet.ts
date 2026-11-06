import type { Router } from '../core/router.js';
import { FormValidator } from '../core/validate.js';
import { employerJobs } from '../services/jobs.js';
import { activePromotionsOf } from '../services/promotion.js';
import { ledgerOf, topUp } from '../services/wallet.js';
import { WALLET_RULES } from '../types.js';
import { walletPage } from '../views/pages/wallet.js';
import { nowISO, page } from './shared.js';

const PAYMENT_METHODS = ['信用卡（模擬）', 'ATM 轉帳（模擬）', '超商代碼（模擬）'];

export function registerWallet(router: Router): void {
  const only: 'employer'[] = ['employer'];

  router.get('/wallet', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    page(
      ctx,
      '錢包與曝光',
      walletPage({
        user,
        ledger: ledgerOf(db, user.id),
        promotions: activePromotionsOf(db, user.id),
        jobs: employerJobs(db, user.id),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '儲值曝光金，替你的職缺購買更多曝光。',
    );
  }, only);

  router.post('/wallet/topup', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const amount = v.integer('amount', {
      label: '儲值金額',
      required: true,
      min: WALLET_RULES.topupMin,
      max: WALLET_RULES.topupMax,
    }, 0);
    const method = v.choice('method', { label: '付款方式', required: true }, PAYMENT_METHODS);

    if (!v.ok || method === '') {
      ctx.flash('error', v.ok ? '請選擇付款方式' : v.message());
      ctx.redirect('/wallet');
      return;
    }

    const result = ctx.services.store.mutate((db) => {
      const stored = db.users.find((item) => item.id === user.id);
      if (stored === undefined) throw new Error('找不到你的帳號');
      const topup = topUp(db, stored, amount, method, nowISO());
      return { topup, balance: stored.balance };
    });
    ctx.flash('success', `已儲值 NT$ ${result.topup.amount.toLocaleString('zh-TW')}，目前餘額 NT$ ${result.balance.toLocaleString('zh-TW')}。`);
    ctx.redirect('/wallet');
  }, only);
}
