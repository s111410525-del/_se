import { badRequest, forbidden } from '../core/errors.js';
import type { Router } from '../core/router.js';
import { FormValidator } from '../core/validate.js';
import { needJob } from '../services/jobs.js';
import {
  applyToJob,
  conversationsFor,
  isParticipant,
  markRead,
  messagesOf,
  needConversation,
  parseStatus,
  sendMessage,
  setConversationStatus,
  totalUnread,
} from '../services/messaging.js';
import { recordClick } from '../services/promotion.js';
import { inboxPage, threadPage } from '../views/pages/messages.js';
import { nowISO, page } from './shared.js';

export function registerMessages(router: Router): void {
  const auth: ('seeker' | 'employer' | 'admin')[] = ['seeker', 'employer', 'admin'];

  router.get('/messages', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const conversations = conversationsFor(db, user);
    page(
      ctx,
      '訊息中心',
      inboxPage({ db, user, conversations, unread: totalUnread(db, user) }),
      '所有應徵與聯繫都在這裡，回覆訊息不會收費。',
    );
  }, auth);

  router.get('/messages/:id', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const conversation = needConversation(db, ctx.params['id'] ?? '');
    if (!isParticipant(conversation, user)) throw forbidden('你不在這則對話中');

    ctx.services.store.mutate(() => {
      markRead(conversation, user.id, nowISO());
    });

    const job = db.jobs.find((item) => item.id === conversation.jobId);
    const seeker = db.users.find((item) => item.id === conversation.seekerId);
    const employer = db.users.find((item) => item.id === conversation.employerId);
    const other = user.id === conversation.employerId ? seeker : employer;

    page(
      ctx,
      `與 ${other?.name ?? '使用者'} 的對話`,
      threadPage({
        db,
        conversation,
        job,
        seeker,
        employer,
        viewer: user,
        messages: messagesOf(db, conversation.id),
        csrfToken: ctx.session?.csrf ?? '',
      }),
      job === undefined ? '職缺已移除' : `職缺：${job.title}`,
    );
  }, auth);

  router.post('/messages/:id', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const conversation = needConversation(db, ctx.params['id'] ?? '');
    if (!isParticipant(conversation, user)) throw forbidden('你不在這則對話中');

    const v = new FormValidator(form);
    const body = v.text('body', { label: '訊息', required: true, maxLength: 2000 });
    if (!v.ok) {
      ctx.flash('error', v.message());
      ctx.redirect(`/messages/${encodeURIComponent(conversation.id)}`);
      return;
    }

    ctx.services.store.mutate((target) => {
      const stored = needConversation(target, conversation.id);
      const sender = target.users.find((item) => item.id === user.id);
      if (sender === undefined) throw badRequest('找不到你的帳號');
      sendMessage(target, stored, sender, body, nowISO());
    });
    ctx.flash('success', '訊息已送出。');
    ctx.redirect(`/messages/${encodeURIComponent(conversation.id)}`);
  }, auth);

  router.post('/messages/:id/status', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const conversation = needConversation(db, ctx.params['id'] ?? '');
    if (user.role !== 'admin' && conversation.employerId !== user.id) {
      throw forbidden('只有企業可以更新應徵狀態');
    }
    const status = parseStatus(form.get('status') ?? '');
    if (status === undefined) throw badRequest('應徵狀態不正確');

    ctx.services.store.mutate((target) => {
      const stored = needConversation(target, conversation.id);
      setConversationStatus(stored, status, nowISO());
    });
    ctx.flash('success', '應徵狀態已更新。');
    ctx.redirect(`/messages/${encodeURIComponent(conversation.id)}`);
  }, auth);

  router.post('/jobs/:id/apply', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const db = ctx.services.store.data;
    const job = needJob(db, ctx.params['id'] ?? '');

    const v = new FormValidator(form);
    const body = v.text('body', { label: '應徵訊息', required: true, maxLength: 1000 });
    if (!v.ok) {
      ctx.flash('error', v.message());
      ctx.redirect(`/jobs/${encodeURIComponent(job.id)}`);
      return;
    }

    try {
      const result = ctx.services.store.mutate((target) => {
        const storedJob = needJob(target, job.id);
        const seeker = target.users.find((item) => item.id === user.id);
        if (seeker === undefined) throw badRequest('找不到你的帳號');
        const applied = applyToJob(target, storedJob, seeker, body, nowISO());
        recordClick(target, storedJob.id);
        return applied;
      });
      ctx.flash(
        'success',
        result.created ? '應徵訊息已送出，企業回覆時會出現在訊息中心。' : '已再次送出訊息，企業會看到你的更新。',
      );
      ctx.redirect(`/messages/${encodeURIComponent(result.conversation.id)}`);
    } catch (err) {
      ctx.flash('error', err instanceof Error ? err.message : '應徵失敗');
      ctx.redirect(`/jobs/${encodeURIComponent(job.id)}`);
    }
  }, ['seeker']);
}
