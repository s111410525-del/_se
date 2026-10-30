import { notFound } from '../core/errors.js';
import type { Context } from '../core/context.js';
import type { Router } from '../core/router.js';
import { FormValidator } from '../core/validate.js';
import { tipWork } from '../services/earnings.js';
import { addComment, removeComment, toggleBookmark } from '../services/engagement.js';
import { canViewWork, needWork } from '../services/works.js';
import type { Work } from '../types.js';
import { REVENUE_RULES } from '../types.js';
import { formatMoney } from '../util/html.js';
import { nowISO } from './shared.js';

function visibleWork(ctx: Context): Work {
  const work = needWork(ctx.services.store.data, ctx.params['id'] ?? '');
  if (!canViewWork(work, ctx.user)) throw notFound('找不到這部作品');
  return work;
}

export function registerEngage(router: Router): void {
  const roles: ('member' | 'admin')[] = ['member', 'admin'];

  router.post('/works/:id/bookmark', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const work = visibleWork(ctx);
    const bookmarked = ctx.services.store.mutate((db) => toggleBookmark(db, work.id, user.id, nowISO()));
    ctx.flash(bookmarked ? 'success' : 'info', bookmarked ? `已將《${work.title}》加入收藏。` : '已取消收藏。');
    ctx.redirect(`/works/${encodeURIComponent(work.id)}`);
  }, roles);

  router.post('/works/:id/comments', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const work = visibleWork(ctx);
    const v = new FormValidator(form);
    const body = v.text('body', { label: '留言', required: true, maxLength: 500 });
    if (!v.ok) {
      ctx.flash('error', v.message());
      ctx.redirect(`/works/${encodeURIComponent(work.id)}#comments`);
      return;
    }
    ctx.services.store.mutate((db) => addComment(db, needWork(db, work.id), user, body, nowISO()));
    ctx.flash('success', '留言已送出。');
    ctx.redirect(`/works/${encodeURIComponent(work.id)}#comments`);
  }, roles);

  router.post('/works/:id/comments/:commentId/delete', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const work = visibleWork(ctx);
    ctx.services.store.mutate((db) => removeComment(db, ctx.params['commentId'] ?? '', user));
    ctx.flash('success', '留言已刪除。');
    ctx.redirect(`/works/${encodeURIComponent(work.id)}#comments`);
  }, roles);

  router.post('/works/:id/tip', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const work = visibleWork(ctx);

    const v = new FormValidator(form);
    const amount = v.integer('amount', {
      label: '打賞金額',
      required: true,
      min: REVENUE_RULES.tipMin,
      max: REVENUE_RULES.tipMax,
    }, 0);
    const message = v.text('message', { label: '給作者的話', maxLength: 200 });

    if (!v.ok) {
      ctx.flash('error', v.message());
      ctx.redirect(`/works/${encodeURIComponent(work.id)}#support`);
      return;
    }
    try {
      const tip = ctx.services.store.mutate((db) => tipWork(db, needWork(db, work.id), user, amount, message, nowISO()));
      ctx.flash('success', `已打賞 ${formatMoney(tip.amount)}，作者可獲得 ${formatMoney(tip.creatorShare)}。謝謝你支持創作！`);
    } catch (err) {
      ctx.flash('error', err instanceof Error ? err.message : '打賞失敗');
    }
    ctx.redirect(`/works/${encodeURIComponent(work.id)}#support`);
  }, roles);
}
