import { badRequest, HttpError } from '../core/errors.js';
import type { Context } from '../core/context.js';
import { appendCookie, clearCookie } from '../core/http.js';
import { verifyPassword } from '../core/password.js';
import type { Router } from '../core/router.js';
import { EMAIL_PATTERN, FormValidator, USERNAME_PATTERN, type Errors } from '../core/validate.js';
import { findById, findByUsername, registerUser, updateProfile } from '../services/accounts.js';
import { SIGNUP_ROLES, type SignupRole, type User } from '../types.js';
import { profilePage } from '../views/pages/profile.js';
import { loginScreen, nowISO, page, registerScreen, sanitizeNext, SESSION_COOKIE } from './shared.js';

function renderProfile(
  ctx: Context,
  user: User,
  errors: Errors = {},
  values?: Record<string, string>,
): void {
  const db = ctx.services.store.data;
  const ownConversations = db.conversations.filter(
    (conversation) =>
      conversation.seekerId === user.id || conversation.employerId === user.id,
  );
  const stats = user.role === 'employer'
    ? {
        jobs: db.jobs.filter((job) => job.employerId === user.id).length,
        applications: ownConversations.length,
      }
    : {
        jobs: ownConversations.length,
        applications: ownConversations.filter((conversation) => conversation.status !== 'closed').length,
      };

  page(
    ctx,
    '帳號資料',
    profilePage({
      user,
      csrfToken: ctx.session?.csrf ?? '',
      errors,
      values: values ?? {
        name: user.name,
        email: user.email,
        company: user.company,
        bio: user.bio,
        avatar: user.avatar,
      },
      stats,
    }),
    '管理個人資料、企業簡介與聯絡方式。',
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
    registerScreen(ctx);
  });

  router.post('/register', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const role = v.choice('role', { label: '帳號類型', required: true }, SIGNUP_ROLES);
    const username = v.text('username', {
      label: '帳號',
      required: true,
      pattern: USERNAME_PATTERN,
      patternHint: '3～24 個英文字母、數字或底線',
    });
    const name = v.text('name', { label: '姓名／聯絡人', required: true, maxLength: 30 });
    const email = v.text('email', {
      label: '電子郵件',
      required: true,
      maxLength: 60,
      pattern: EMAIL_PATTERN,
      patternHint: 'name@example.com',
    });
    const company = v.text('company', {
      label: '公司名稱',
      required: role === 'employer',
      maxLength: 40,
    });
    const password = v.text('password', { label: '密碼', required: true, min: 8, maxLength: 200 });
    const confirmPassword = v.text('confirmPassword', { label: '確認密碼', required: true, maxLength: 200 });
    const errors: Errors = { ...v.errors };

    if (password !== '' && confirmPassword !== '' && password !== confirmPassword) {
      errors['confirmPassword'] = '兩次輸入的密碼不一致';
    }
    if (form.get('agree') !== '1') {
      errors['form'] = '請先確認你了解這是課程示範平台';
    }

    const values = {
      role: role === '' ? (form.get('role') ?? 'seeker') : role,
      username,
      name,
      email,
      company,
    };
    if (Object.keys(errors).length > 0 || role === '') {
      registerScreen(ctx, errors, values, 400);
      return;
    }

    let createdUser: User;
    try {
      createdUser = ctx.services.store.mutate((db) =>
        registerUser(db, {
          username,
          name,
          email,
          password,
          role: role as SignupRole,
          company,
        }, nowISO()),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '註冊失敗';
      registerScreen(ctx, { form: message }, values, err instanceof HttpError ? err.status : 400);
      return;
    }

    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    const session = ctx.services.sessions.create(createdUser.id);
    appendCookie(ctx.res, SESSION_COOKIE, session.token, {
      maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000),
    });
    ctx.services.sessions.addFlash(
      session,
      'success',
      createdUser.role === 'employer'
        ? `歡迎加入職光，${createdUser.name}！先刊登第一個職缺吧。`
        : `歡迎加入職光，${createdUser.name}！開始尋找適合你的工作。`,
    );
    ctx.redirect(createdUser.role === 'employer' ? '/employer' : '/dashboard');
  });

  router.post('/logout', async (ctx) => {
    const form = await ctx.form();
    ctx.requireCsrf(form);
    if (ctx.session !== undefined) ctx.services.sessions.destroy(ctx.session.token);
    clearCookie(ctx.res, SESSION_COOKIE);
    const fresh = ctx.services.sessions.create('');
    appendCookie(ctx.res, SESSION_COOKIE, fresh.token, {
      maxAge: Math.floor(ctx.services.config.sessionTtlMs / 1000),
    });
    ctx.services.sessions.addFlash(fresh, 'info', '你已經登出。');
    ctx.redirect('/login');
  });

  router.get('/profile', (ctx) => {
    renderProfile(ctx, ctx.requireUser());
  }, ['seeker', 'employer', 'admin']);

  router.post('/profile', async (ctx) => {
    const user = ctx.requireUser();
    const form = await ctx.form();
    ctx.requireCsrf(form);

    const v = new FormValidator(form);
    const name = v.text('name', { label: '姓名／聯絡人', required: true, maxLength: 30 });
    const email = v.text('email', {
      label: '電子郵件',
      required: true,
      maxLength: 60,
      pattern: EMAIL_PATTERN,
      patternHint: 'name@example.com',
    });
    const company = v.text('company', {
      label: '公司名稱',
      required: user.role === 'employer',
      maxLength: 40,
    });
    const bio = v.text('bio', { label: '自我介紹／企業簡介', maxLength: 400 });
    const avatar = v.text('avatar', { label: '頭像符號', maxLength: 8 });
    const errors: Errors = { ...v.errors };
    const values = { name, email, company, bio, avatar };

    if (Object.keys(errors).length === 0) {
      try {
        ctx.services.store.mutate((db) => {
          const target = findById(db, user.id);
          if (target === undefined) throw badRequest('找不到你的帳號');
          updateProfile(db, target, { name, email, company, bio, avatar });
        });
      } catch (err) {
        errors['form'] = err instanceof Error ? err.message : '更新失敗';
      }
    }

    if (Object.keys(errors).length > 0) {
      renderProfile(ctx, user, errors, values);
      return;
    }
    ctx.flash('success', '個人資料已更新。');
    ctx.redirect('/profile');
  }, ['seeker', 'employer', 'admin']);
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
