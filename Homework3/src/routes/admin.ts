import type { Router } from '../core/router.js';
import { needJob, setPublished } from '../services/jobs.js';
import { startAdminPromotion } from '../services/promotion.js';
import {
  adminDashboardPage,
  adminJobsPage,
  adminTransactionsPage,
  adminUsersPage,
} from '../views/pages/admin.js';
import { nowISO, page } from './shared.js';

export function registerAdmin(router: Router): void {
  const only: 'admin'[] = ['admin'];

  router.get('/admin', (ctx) => {
    const db = ctx.services.store.data;
    page(ctx, '營運後台', adminDashboardPage(db), '平台營運數據與管理入口。');
  }, only);

  router.get('/admin/users', (ctx) => {
    const db = ctx.services.store.data;
    page(ctx, '使用者管理', adminUsersPage(db), '查看所有註冊帳號、角色與錢包狀態。');
  }, only);

  router.get('/admin/jobs', (ctx) => {
    const db = ctx.services.store.data;
    const jobs = [...db.jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    page(
      ctx,
      '職缺管理',
      adminJobsPage({ db, jobs, csrfToken: ctx.session?.csrf ?? '' }),
      '可替任何職缺贈送曝光，或暫時關閉不當職缺。',
    );
  }, only);

  router.get('/admin/transactions', (ctx) => {
    const db = ctx.services.store.data;
    const topups = [...db.topups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const ledger = [...db.ledger].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    page(
      ctx,
      '交易紀錄',
      adminTransactionsPage({ db, topups, ledger }),
      '所有模擬儲值與錢包扣款紀錄。',
    );
  }, only);

  router.post('/admin/jobs/:id/promote', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const job = needJob(ctx.services.store.data, ctx.params['id'] ?? '');
    const promotion = ctx.services.store.mutate((db) => {
      const stored = needJob(db, job.id);
      return startAdminPromotion(db, stored, nowISO());
    });
    ctx.flash(
      'success',
      `已贈送「${job.title}」7 天曝光，到期日 ${new Date(promotion.expiresAt).toLocaleDateString('zh-TW')}。`,
    );
    ctx.redirect('/admin/jobs');
  }, only);

  router.post('/admin/jobs/:id/visibility', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const job = needJob(ctx.services.store.data, ctx.params['id'] ?? '');
    const published = form.get('published') === '1';
    ctx.services.store.mutate((db) => {
      const stored = needJob(db, job.id);
      setPublished(stored, published, nowISO());
    });
    ctx.flash('success', published ? '職缺已公開。' : '職缺已關閉。');
    ctx.redirect('/admin/jobs');
  }, only);
}
