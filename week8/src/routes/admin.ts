import { badRequest } from '../core/errors.js';
import type { Router } from '../core/router.js';
import { pendingWithdrawals, processWithdrawal } from '../services/earnings.js';
import { activePromotion, startAdminPromotion } from '../services/promotion.js';
import { needWork, setFeatured } from '../services/works.js';
import { adminDashboard, adminPayoutsPage, adminUsersPage, adminWorksPage } from '../views/pages/admin.js';
import { nowISO, page } from './shared.js';

export function registerAdmin(router: Router): void {
  const only: 'admin'[] = ['admin'];

  router.get('/admin', (ctx) => {
    const db = ctx.services.store.data;
    page(ctx, '平台管理', adminDashboard(db, Date.now()), '作品推流、使用者与撥款審核。');
  }, only);

  router.get('/admin/works', (ctx) => {
    const db = ctx.services.store.data;
    const now = Date.now();
    const works = [...db.works].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    page(
      ctx,
      '作品與推流',
      adminWorksPage({
        db,
        works,
        promotedIds: new Set(works.filter((work) => activePromotion(db, work.id, now) !== undefined).map((work) => work.id)),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      '設定編輯精選，或替任何作品開啟 14 天平台推流。',
    );
  }, only);

  router.post('/admin/works/:id/feature', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    context: {
      ctx.services.store.mutate((target) => {
        const stored = needWork(target, work.id);
        setFeatured(stored, !stored.featured);
      });
    }
    const updated = ctx.services.store.data.works.find((item) => item.id === work.id);
    ctx.flash('success', updated?.featured === true ? `《${work.title}》已設為編輯精選。` : `已取消《${work.title}》的精選。`);
    ctx.redirect('/admin/works');
  }, only);

  router.post('/admin/works/:id/promote', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const work = needWork(db, ctx.params['id'] ?? '');
    ctx.services.store.mutate((target) => {
      const stored = needWork(target, work.id);
      startAdminPromotion(target, stored, nowISO());
    });
    ctx.flash('success', `已替《${work.title}》啟動 14 天平台推流。`);
    ctx.redirect('/admin/works');
  }, only);

  router.get('/admin/users', (ctx) => {
    const db = ctx.services.store.data;
    const users = [...db.users].sort((a, b) => a.role.localeCompare(b.role) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    page(ctx, '使用者管理', adminUsersPage({ db, users }), `共 ${users.length} 個帳號。`);
  }, only);

  router.get('/admin/payouts', (ctx) => {
    const db = ctx.services.store.data;
    const pending = pendingWithdrawals(db);
    const history = db.withdrawals
      .filter((item) => item.status !== 'pending')
      .sort((a, b) => Date.parse(b.processedAt ?? b.requestedAt) - Date.parse(a.processedAt ?? a.requestedAt));
    page(
      ctx,
      '撥款審核',
      adminPayoutsPage({ db, pending, history, csrfToken: ctx.session?.csrf ?? '' }),
      '核對創作者的可提領餘額，標記撥款或退回申請。',
    );
  }, only);

  router.post('/admin/payouts/:id', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const status = form.get('status') ?? '';
    if (status !== 'paid' && status !== 'rejected') throw badRequest('撥款狀態不正確');
    ctx.services.store.mutate((db) =>
      processWithdrawal(db, ctx.params['id'] ?? '', status, '', nowISO()),
    );
    ctx.flash('success', status === 'paid' ? '已標記為撥款完成。' : '已退回提領申請，金額回到創作者的可提領餘額。');
    ctx.redirect('/admin/payouts');
  }, only);
}
