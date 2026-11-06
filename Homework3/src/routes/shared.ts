import { badRequest, HttpError } from '../core/errors.js';
import type { Context } from '../core/context.js';
import { demoAccounts } from '../db/seed.js';
import { authLayout, layout } from '../views/layout.js';
import { loginPage, registerPage } from '../views/pages/auth.js';

export const SESSION_COOKIE = 'jobbeam_session';

/** 以一般版面輸出頁面，並自動帶入 flash 訊息。 */
export function page(
  ctx: Context,
  title: string,
  body: string,
  subtitle?: string,
  bodyClass?: string,
  hidePageHead = false,
): void {
  ctx.html(
    layout({
      title,
      path: ctx.path,
      user: ctx.user,
      csrfToken: ctx.session?.csrf ?? '',
      flash: ctx.services.sessions.takeFlash(ctx.session),
      body,
      subtitle,
      bodyClass,
      hidePageHead,
    }),
  );
}

/** 登入頁（含錯誤訊息與示範帳號）。 */
export function loginScreen(ctx: Context, error: string | null, username: string, status = 200): void {
  const next = sanitizeNext(ctx.query.get('next') ?? '/');
  ctx.html(
    authLayout({
      title: '登入',
      body: loginPage({
        error,
        username,
        csrfToken: ctx.session?.csrf ?? '',
        next,
        demoAccounts: demoAccounts(),
      }),
    }),
    status,
  );
}

export function registerScreen(
  ctx: Context,
  errors: Record<string, string> = {},
  values: Record<string, string> = {},
  status = 200,
): void {
  ctx.html(
    authLayout({
      title: '免費註冊',
      body: registerPage({ errors, values, csrfToken: ctx.session?.csrf ?? '' }),
    }),
    status,
  );
}

export function authScreen(title: string, body: string): string {
  return authLayout({ title, body });
}

/** 只允許站內相對路徑，避免 open redirect。 */
export function sanitizeNext(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/** 服務層的 HttpError 直接沿用；其他例外包成 400，避免把堆疊顯示給使用者。 */
export function asUserError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return badRequest(err instanceof Error ? err.message : '操作失敗，請稍後再試');
}

export function nowISO(): string {
  return new Date().toISOString();
}
