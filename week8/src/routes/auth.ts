import { badRequest, conflict, HttpError } from '../core/errors.js';
import type { Context } from '../core/context.js';
import { appendCookie, clearCookie } from '../core/http.js';
import { verifyPassword } from '../core/password.js';
import type { Router } from '../core/router.js';
import { EMAIL_PATTERN, FormValidator, USERNAME_PATTERN, type Errors } from '../core/validate.js';
import { findById, findByUsername, needUser, registerUser, setPlan, updateProfile } from '../services/accounts.js';
import { totalEarned } from '../services/earnings.js';
import { ensurePlanPromotion } from '../services/promotion.js';
import type { Database, Plan, User } from '../types.js';
import { PLANS } from '../types.js';
import { registerPage } from '../views/pages/auth.js';
import { profilePage } from '../views/pages/profile.js';
import { authScreen, loginScreen, nowISO, page, sanitizeNext, SESSION_COOKIE } from './shared.js';

function profileTotals(db: Database, user: User): { works: number; views: number; earned: number } {
  const works = db.works.filter((work) => work.creatorId === user.id);
  return {
    works: works.length,
    views: works.reduce((sum, work) => sum + work.views, 0),
    earned: totalEarned(db, user.id),
  };
}

function renderProfile(
  ctx: Context,
  user: User,
  errors: Errors = {},
  values?: Record<string, string>,
): void {
  const db = ctx.services.store.data;
  page(
    ctx,
    '帳號與方案',
    profilePage({
      user,
      csrfToken: ctx.session?.csrf ?? '',
      errors,
      values: values ?? { name: user.name, email: user.email, bio: user.bio, avatar: user.avatar },
      totals: profileTotals(db, user),
    }),
    '管理個人資料，並隨時切換免費或付費方案。',
  );
}

export function registerAuth(router: Router): void {
  router.get('/login', (ctx) => {
    if (ctx.user !== undefined) {
      ctx.redirect('/');
      return;
    }
    loginScreen(ctx, null, '');
  });

  router.post('/login', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const username = v.text('username', { label: '帳號', required: true, maxLength: 40 });
    const password = v.text('password', { label: '密碼', required: true, maxLength: 200 });
    const next = sanitizeNext(form.get('next') ?? '/');

    if (!v.ok) {
      loginScreen(ctx, v.message(), username, 400);
      return;
    }

    const guard = ctx.services.loginGuards.get(username.toLowerCase());
    const stamp = Date.now();
    if (guard !== undefined && guard.lockedUntil > stamp) {
      const seconds = Math.ceil((guard.lockedUntil - stamp) / 1000);
      loginScreen(ctx, `登入失敗次數過多，請於 ${seconds} 秒後再試`, username, 429);
      return;
    }

    const user = findByUsername(ctx.services.store.data, username);
    if (user === undefined || !user.active || !verifyPassword(password, user)) {
      registerFailure(ctx, username, stamp);
      loginScreen(ctx, '帳號或密碼錯誤', username, 401);
      return;
    }

    ctx.services.loginGuards.delete(username.toLowerCase());
    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    const created = ctx.services.sessions.create(user.id);
    appendCookie(ctx.res, SESSION_COOKIE, created.token, {
      maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000),
    });
    ctx.services.sessions.addFlash(created, 'success', `歡迎回來，${user.name}！`);
    ctx.redirect(next);
  });

  router.get('/register', (ctx) => {
    if (ctx.user !== undefined) {
      ctx.redirect('/');
      return;
    }
    ctx.html(authScreen('免費註冊', registerPage({ errors: {}, values: {}, csrfToken: ctx.session?.csrf ?? '' })));
  });

  router.post('/register', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const username = v.text('username', { label: '帳號', required: true, pattern: USERNAME_PATTERN, patternHint: '3～24 個英文字母、數字或底線' });
    const name = v.text('name', { label: '筆名', required: true, maxLength: 20 });
    const email = v.text('email', { label: '電子郵件', required: true, maxLength: 60, pattern: EMAIL_PATTERN, patternHint: 'name@example.com' });
    const password = v.text('password', { label: '密碼', required: true, min: 8, maxLength: 200 });
    const confirmPassword = v.text('confirmPassword', { label: '確認密碼', required: true, maxLength: 200 });
    const errors: Errors = { ...v.errors };

    if (password !== '' && confirmPassword !== '' && password !== confirmPassword) {
      errors['confirmPassword'] = '兩次輸入的密碼不一致';
    }
    if (form.get('agree') !== '1') {
      errors['form'] = '請先確認你了解這是課程示範平台';
    }

    const values = { username, name, email };
    if (Object.keys(errors).length > 0) {
      ctx.html(
        authScreen('免費註冊', registerPage({ errors, values, csrfToken: ctx.session?.csrf ?? '' })),
        400,
      );
      return;
    }

    let createdUser: User;
    try {
      createdUser = ctx.services.store.mutate((db) => registerUser(db, { username, name, email, password }, nowISO()));
    } catch (err) {
      const message = err instanceof Error ? err.message : '註冊失敗';
      ctx.html(
        authScreen(
          '免費註冊',
          registerPage({
            errors: { form: message },
            values,
            csrfToken: ctx.session?.csrf ?? '',
          }),
        ),
        err instanceof HttpError ? err.status : 400,
      );
      return;
    }

    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    const session = ctx.services.sessions.create(createdUser.id);
    appendCookie(ctx.res, SESSION_COOKIE, session.token, {
      maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000),
    });
    ctx.services.sessions.addFlash(session, 'success', `歡迎加入墨流，${createdUser.name}！先發表你的第一部作品吧。`);
    ctx.redirect('/studio');
  });

  router.post('/logout', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    clearCookie(ctx.res, SESSION_COOKIE);
    const fresh = ctx.services.sessions.create('');
    appendCookie(ctx.res, SESSION_COOKIE, fresh.token, { maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000) });
    ctx.services.sessions.addFlash(fresh, 'info', '你已經登出。');
    ctx.redirect('/login');
  });

  router.get('/profile', (ctx) => {
    renderProfile(ctx, ctx.requireUser());
  }, ['member', 'admin']);

  router.post('/profile', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const name = v.text('name', { label: '筆名', required: true, maxLength: 20 });
    const avatar = v.text('avatar', { label: '頭像符號', maxLength: 8 });
    const email = v.text('email', {
      label: '電子郵件',
      required: true,
      maxLength: 60,
      pattern: EMAIL_PATTERN,
      patternHint: 'name@example.com',
    });
    const bio = v.text('bio', { label: '作者簡介', maxLength: 300 });
    const errors: Errors = { ...v.errors };

    if (Object.keys(errors).length === 0) {
      try {
        ctx.services.store.mutate((db) => {
          const target = needUser(db, user.id);
          updateProfile(db, target, { name, email, bio, avatar });
        });
      } catch (err) {
        errors['form'] = err instanceof Error ? err.message : '更新失敗';
      }
    }

    if (Object.keys(errors).length > 0) {
      renderProfile(ctx, user, errors, { name, email, bio, avatar });
      return;
    }
    ctx.flash('success', '個人資料已更新。');
    ctx.redirect('/profile');
  }, ['member', 'admin']);

  router.post('/account/plan', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);
    const requested = form.get('plan') ?? '';
    if (!(PLANS as string[]).includes(requested)) throw badRequest('方案選項不正確');
    const plan = requested as Plan;

    ctx.services.store.mutate((db) => {
      const target = findById(db, user.id);
      if (target === undefined) throw conflict('找不到你的帳號');
      setPlan(target, plan, nowISO());
      if (plan === 'pro') {
        for (const work of db.works.filter((item) => item.creatorId === target.id && item.published)) {
          ensurePlanPromotion(db, work, nowISO());
        }
      }
    });

    if (plan === 'pro') {
      ctx.flash('success', '已升級為付費帳號。你的公開作品已獲得系統推流，閱讀與打賞收益也一併開通。');
    } else {
      ctx.flash('info', '已切換為免費帳號。既有餘額仍可提領，新作品將不再產生收益或自動推流。');
    }
    ctx.redirect(plan === 'pro' ? '/studio' : '/profile#plans');
  }, ['member', 'admin']);
}

function registerFailure(ctx: Context, username: string, stamp: number): void {
  const key = username.trim().toLowerCase();
  const guard = ctx.services.loginGuards.get(key) ?? { failures: 0, lockedUntil: 0 };
  guard.failures += 1;
  if (guard.failures >= ctx.services.config.loginMaxFailures) {
    guard.failures = 0;
    guard.lockedUntil = stamp + ctx.services.config.loginLockoutMs;
  }
  ctx.services.loginGuards.set(key, guard);
}

